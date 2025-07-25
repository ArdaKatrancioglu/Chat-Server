const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();

async function getBalanceFromFirestore(uid) {
    const db = admin.firestore();
    try {
        const docRef = db.collection('users').doc(uid);
        const doc = await docRef.get();
        if (!doc.exists) return null;

        const data = doc.data();
        return data.seleniumCoins ?? 0;
    } catch (err) {
        console.error("Firestore error:", err);
        return null;
    }
}


//TODO: simdi de bu skinleri inventory ye ekleme zamani
const skinDataPath = path.join(__dirname, 'skinData', 'skin_data.json');

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

    // Load chest data
    const chestPath = path.join(__dirname, 'chests', `${chestId}.json`);
    if (!fs.existsSync(chestPath)) {
        return res.status(404).json({ error: 'Chest not found' });
    }
    const chestData = JSON.parse(fs.readFileSync(chestPath));

    // Check balance
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

    // Deduct price
    await db.collection('users').doc(uid).update({
        seleniumCoins: admin.firestore.FieldValue.increment(-chestData.price)
    });

    // Weighted skin selection
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
    const candidates = chestData.skins[rarity];
    const selectedSkinId = candidates[Math.floor(Math.random() * candidates.length)];

    // Load skin data from skin_data.json
    let skinData = null;
    try {
        const raw = JSON.parse(fs.readFileSync(skinDataPath));
        const entries = Array.isArray(raw.entries) ? raw.entries : [];
        const entry = entries.find(e => e.id === selectedSkinId.toString());
        skinData = entry?.data ?? null;
    } catch (err) {
        console.error("Skin data error:", err);
    }

    // Respond
    res.json({
        success: true,
        skinId: selectedSkinId,
        skinData,            // { skinName, skinDescription, rarity } or null
        rarity,
        newBalance: balance - chestData.price
    });
});


module.exports = router;