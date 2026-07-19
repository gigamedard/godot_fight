# Graph Report - G:\DEV\GODOT_GAME  (2026-07-19)

## Corpus Check
- Corpus is ~7,096 words - fits in a single context window. You may not need a graph.

## Summary
- 39 nodes · 67 edges · 8 communities
- Extraction: 82% EXTRACTED · 16% INFERRED · 1% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Animation State Management  Camera Shake Effects  Combat Animation System  Graphify Knowledge Graph  JavaScript-Godot Bridge|Animation State Management / Camera Shake Effects / Combat Animation System / Graphify Knowledge Graph / JavaScript-Godot Bridge]]
- [[_COMMUNITY_Token Betting System  Docker Infrastructure  Duel Matchmaking System  Project Handover Document  Laravel Backend API|Token Betting System / Docker Infrastructure / Duel Matchmaking System / Project Handover Document / Laravel Backend API]]
- [[_COMMUNITY_Battle Royale Lobby  Character Selection UI  Matchmaking UI Characters  QR Code Scanning  React Matchmaking UI|Battle Royale Lobby / Character Selection UI / Matchmaking UI Characters / QR Code Scanning / React Matchmaking UI]]
- [[_COMMUNITY_Blender MCP Asset Pipeline  Godot Character Roster (p1-p4)  Blender Texture Extractor  Blender Mixamo to Godot Converter  Blender Mixamo Prep Tool|Blender MCP Asset Pipeline / Godot Character Roster (p1-p4) / Blender Texture Extractor / Blender Mixamo to Godot Converter / Blender Mixamo Prep Tool]]

## God Nodes (most connected - your core abstractions)
1. `Main Godot Combat Script` - 16 edges
2. `Duel Matchmaking System` - 9 edges
3. `Enhanced HTML Matchmaking with Betting` - 8 edges
4. `Architecture Handover Document` - 8 edges
5. `HTML Matchmaking Interface` - 7 edges
6. `React Matchmaking UI` - 6 edges
7. `Project Handover Document` - 6 edges
8. `Combat Animation System` - 6 edges
9. `Character Selection UI` - 6 edges
10. `Blender MCP Asset Pipeline` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Main Godot Combat Script` --conceptually_related_to--> `React Matchmaking UI`  [INFERRED]
  scripts/main.gd → flow_ui_menu_matchmaking.tsx
- `Battle Royale Lobby` --conceptually_related_to--> `Duel Matchmaking System`  [INFERRED]
  flow_ui_menu_matchmaking.tsx → inter_match2.html
- `React Matchmaking UI` --implements--> `Duel Matchmaking System`  [EXTRACTED]
  flow_ui_menu_matchmaking.tsx → inter_match2.html
- `React Matchmaking UI` --conceptually_related_to--> `HTML Matchmaking Interface`  [INFERRED]
  flow_ui_menu_matchmaking.tsx → interface_matchmaking.html
- `Blender Texture Extractor` --implements--> `Blender MCP Asset Pipeline`  [EXTRACTED]
  scripts/tools/blender_extract_texture.py → HANDOVER.md

## Communities (8 total, 0 thin omitted)

### Community 0 - "Animation State Management / Camera Shake Effects / Combat Animation System / Graphify Knowledge Graph / JavaScript-Godot Bridge"
Cohesion: 0.31
Nodes (10): Animation State Management, Camera Shake Effects, Combat Animation System, Graphify Knowledge Graph, JavaScript-Godot Bridge, Particle Effects System, Rock-Paper-Scissors Game Logic, FBX Animation Inspector (+2 more)

### Community 1 - "Token Betting System / Docker Infrastructure / Duel Matchmaking System / Project Handover Document / Laravel Backend API"
Cohesion: 0.42
Nodes (9): Token Betting System, Docker Infrastructure, Duel Matchmaking System, Project Handover Document, Laravel Backend API, Laravel Reverb WebSockets, Smart Contract Escrow, Web3 Blockchain Integration (+1 more)

### Community 2 - "Battle Royale Lobby / Character Selection UI / Matchmaking UI Characters / QR Code Scanning / React Matchmaking UI"
Cohesion: 0.62
Nodes (7): Battle Royale Lobby, Character Selection UI, Matchmaking UI Characters, QR Code Scanning, React Matchmaking UI, Enhanced HTML Matchmaking with Betting, HTML Matchmaking Interface

### Community 3 - "Blender MCP Asset Pipeline / Godot Character Roster (p1-p4) / Blender Texture Extractor / Blender Mixamo to Godot Converter / Blender Mixamo Prep Tool"
Cohesion: 0.40
Nodes (5): Blender MCP Asset Pipeline, Godot Character Roster (p1-p4), Blender Texture Extractor, Blender Mixamo to Godot Converter, Blender Mixamo Prep Tool

## Ambiguous Edges - Review These
- `Character Selection UI` → `Matchmaking UI Characters`  [AMBIGUOUS]
  None · relation: conceptually_related_to

## Knowledge Gaps
- **5 isolated node(s):** `Blender Texture Extractor`, `Blender Mixamo to Godot Converter`, `Blender Mixamo Prep Tool`, `FBX Animation Inspector`, `GLB Animation Inspector`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Character Selection UI` and `Matchmaking UI Characters`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Main Godot Combat Script` connect `Animation State Management / Camera Shake Effects / Combat Animation System / Graphify Knowledge Graph / JavaScript-Godot Bridge` to `Token Betting System / Docker Infrastructure / Duel Matchmaking System / Project Handover Document / Laravel Backend API`, `Battle Royale Lobby / Character Selection UI / Matchmaking UI Characters / QR Code Scanning / React Matchmaking UI`, `Blender MCP Asset Pipeline / Godot Character Roster (p1-p4) / Blender Texture Extractor / Blender Mixamo to Godot Converter / Blender Mixamo Prep Tool`?**
  _High betweenness centrality (0.324) - this node is a cross-community bridge._
- **Why does `Blender MCP Asset Pipeline` connect `Blender MCP Asset Pipeline / Godot Character Roster (p1-p4) / Blender Texture Extractor / Blender Mixamo to Godot Converter / Blender Mixamo Prep Tool` to `Animation State Management / Camera Shake Effects / Combat Animation System / Graphify Knowledge Graph / JavaScript-Godot Bridge`, `Token Betting System / Docker Infrastructure / Duel Matchmaking System / Project Handover Document / Laravel Backend API`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `Enhanced HTML Matchmaking with Betting` connect `Battle Royale Lobby / Character Selection UI / Matchmaking UI Characters / QR Code Scanning / React Matchmaking UI` to `Animation State Management / Camera Shake Effects / Combat Animation System / Graphify Knowledge Graph / JavaScript-Godot Bridge`, `Token Betting System / Docker Infrastructure / Duel Matchmaking System / Project Handover Document / Laravel Backend API`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Main Godot Combat Script` (e.g. with `React Matchmaking UI` and `Enhanced HTML Matchmaking with Betting`) actually correct?**
  _`Main Godot Combat Script` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Duel Matchmaking System` (e.g. with `Battle Royale Lobby` and `Web3 Blockchain Integration`) actually correct?**
  _`Duel Matchmaking System` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Enhanced HTML Matchmaking with Betting` (e.g. with `HTML Matchmaking Interface` and `Main Godot Combat Script`) actually correct?**
  _`Enhanced HTML Matchmaking with Betting` has 2 INFERRED edges - model-reasoned connections that need verification._