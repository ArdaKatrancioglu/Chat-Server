const express = require('express');
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const router = express.Router();
const db = admin.firestore();
const skinDataPath = path.join(__dirname, 'skinData', 'skin_data.json');

// Kullanıcının bakiyesini Firestore'dan alır
async function getBalanceFromFirestore(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return null;
    return doc.data().seleniumCoins ?? 0;
  } catch (err) {
    console.error("Firestore error:", err);
    return null;
  }
}

// Seçilen skin'i kullanıcının envanterine kaydeder
async function addSkinToInventory(uid, skinId, skinData, patternVector, ownerName) {
  const inventoryDoc = {
    skinId,
    onlyMelee: skinData.onlyMelee,
    skinName: skinData.skinName,
    skinDescription: skinData.skinDescription,
    ownerId: uid,
    ownerName,
    patternVector,
    acquiredAt: admin.firestore.Timestamp.now()
  };

  const docRef = await db
    .collection('users')
    .doc(uid)
    .collection('inventory')
    .add(inventoryDoc);

  return {
    skinDocId: docRef.id,
    ...inventoryDoc
  };
}

router.post('/:chestId', express.json(), async (req, res) => {
  const chestId = req.params.chestId;
  const idToken = req.headers.authorization?.split('Bearer ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'No token provided' });
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    console.error("Invalid token:", err);
    return res.status(401).json({ error: 'Invalid token' });
  }
  const uid = decoded.uid;

  // Chest JSON dosyasını oku
  const chestPath = path.join(__dirname, 'chests', `${chestId}.json`);
  if (!fs.existsSync(chestPath)) {
    return res.status(404).json({ error: 'Chest '+ chestId +' not found' });
  }
  const chestData = JSON.parse(fs.readFileSync(chestPath));

  // Bakiye kontrolü
  const balance = await getBalanceFromFirestore(uid);
  if (balance === null) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (balance < chestData.price) {
    return res.status(403).json({
      error: 'Insufficient balance',
      current: balance,
      required: chestData.price
    });
  }

  // Fiyatı düş
  await db.collection('users').doc(uid).update({
    seleniumCoins: admin.firestore.FieldValue.increment(-chestData.price)
  });


  // Rasgele rarity seçimi
  const roll = Math.random() * 100;
  let rarity = 'common';
  let sum = 0;
  const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const chanceMap = {
    common: chestData.commonChance,
    uncommon: chestData.uncommonChance,
    rare: chestData.rareChance,
    epic: chestData.epicChance,
    legendary: chestData.legendaryChance
  };
  for (let r of rarityOrder) {
    sum += chanceMap[r];
    if (roll < sum) {
      rarity = r;
      break;
    }
  }

  // Skin listeden seç
  const candidates = chestData.skins[rarity];
  const selectedSkinId = candidates[Math.floor(Math.random() * candidates.length)];

  if (selectedSkinId == undefined){
    console.error("Skin data id is undefined! Mostly there is no " + rarity + " rare skins in chest! Bad setup!");
    res.status(500).json("Skin data id is undefined! Mostly there is no " + rarity + " rare skins in chest! Bad setup! Fix it dumbass");
    return;
  }

  // skin_data.json'dan veri yükle
  let skinData = null;
  try {
    //console.log("selectedSkinId:", selectedSkinId);
    const raw = JSON.parse(fs.readFileSync(skinDataPath));
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    //console.log("entries sample:", entries[0]);
    const entry = entries.find(e => e.id === selectedSkinId.toString());
    skinData = entry?.data ?? null;
  } catch (err) {
    console.error("Skin data error:", err);
  }

  // Server-side rastgele patternVector oluştur
  const patternVector = [
      randomStep(0.001),
      randomStep(0.001),
      randomStep(0.001)
  ];

  // Envantere ekle
  let inventoryItem;
  try {
    const ownerName = decoded.username ?? decoded.name ?? uid;
    inventoryItem = await addSkinToInventory(uid, selectedSkinId, skinData, patternVector, ownerName);
  } catch (err) {
    console.error("Inventory save error:", err);
    return res.status(500).json({ error: 'Failed to save inventory item' });
  }

  // Response
  res.json({
    success: true,
    chestId,
    skinId: selectedSkinId,
    rarity,
    newBalance: balance - chestData.price,
    skinData,        // { skinName, skinDescription, rarity } veya null
    inventoryItem    // { skinDocId, skinId, skinName, … }
  });
});

module.exports = router;

function randomStep(step = 0.05) {
    return Math.floor(Math.random() / step) * step;
}
