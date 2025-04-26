# Suevical 3D — Chat Server

A lightweight, scalable WebSocket server developed for **Suevical 3D**, enabling real-time communication between clients with room and message type support.

## Features

- Real-time messaging with WebSocket
- Support for user roles: `User`, `Admin`, `Information`, and `Server`
- Basic room-based message filtering (handled client-side)
- Heartbeat mechanism to detect and terminate inactive connections
- Fully compatible with Unity, Web, and other WebSocket-compatible clients
- Minimal, extensible, and production-ready

## Prerequisites

- Node.js (v14.x or newer)
- Ngrok (optional, for external public tunneling)

## Getting Started

- Clone the repository and navigate into it
- Install Node.js dependencies if needed
- Start the server locally on port 8080
- (Optional) Open your server to the internet using Ngrok

## Server Overview

| File | Description |
| :--- | :--- |
| `server.js` | Core server logic: connection handling, message broadcasting, heartbeat monitoring |

The server listens on port **8080** and automatically accepts WebSocket connections.

## Data Model

Messages exchanged between client and server follow this structure:

| Field | Description |
| :--- | :--- |
| `uid` | Unique user identifier (optional) |
| `roomId` | Logical room for message routing (string) |
| `username` | Display name of the sender |
| `level` | Sender's user level (integer) |
| `message` | Content of the chat message |
| `type` | Message classification: `User`, `Admin`, `Information`, `Server` |
| `timestamp` | Message creation time (Unix epoch seconds) |

## Roadmap

Planned enhancements:

- Full server-side room-based message routing
- Authentication and authorization systems
- Moderation tools (mute, kick, ban)
- Private messaging (direct user-to-user communication)
- Docker containerization for streamlined deployment

## License

This project is distributed under an open-source license.  
Usage in both personal and commercial projects is permitted.  
Attribution is appreciated but not required.

## About

Developed by **Arda Katrancıoğlu**  
for the **Suevical 3D** project.
