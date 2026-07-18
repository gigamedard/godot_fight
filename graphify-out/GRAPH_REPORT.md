# Graph Report - G:\DEV\GODOT_GAME  (2026-07-16)

## Corpus Check
- Corpus is ~898 words - fits in a single context window. You may not need a graph.

## Summary
- 34 nodes · 35 edges · 7 communities
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Game Characters & Combat|Game Characters & Combat]]
- [[_COMMUNITY_Web3 & Frontend Integration|Web3 & Frontend Integration]]
- [[_COMMUNITY_Backend Infrastructure|Backend Infrastructure]]
- [[_COMMUNITY_Blender & Asset Pipeline|Blender & Asset Pipeline]]

## God Nodes (most connected - your core abstractions)
1. `Godot Web3 Combat Game` - 8 edges
2. `Docker Infrastructure` - 5 edges
3. `main.gd` - 5 edges
4. `Character Selection Screen` - 5 edges
5. `Character Integration Workflow` - 4 edges
6. `Godot 4` - 3 edges
7. `Laravel API` - 3 edges
8. `Vanilla JS Frontend` - 3 edges
9. `MCP Protocol` - 3 edges
10. `Web3 Authentication` - 2 edges

## Surprising Connections (you probably didn't know these)
- `Godot Web3 Combat Game` --references--> `Character Integration Workflow`  [EXTRACTED]
  HANDOVER.md → HANDOVER.md  _Bridges community 1 → community 3_
- `Godot Web3 Combat Game` --references--> `Docker Infrastructure`  [EXTRACTED]
  HANDOVER.md → HANDOVER.md  _Bridges community 1 → community 2_

## Communities (7 total, 0 thin omitted)

### Community 0 - "Game Characters & Combat"
Cohesion: 0.22
Nodes (10): Animation State Machine, Big Choco (p4), Character Selection Screen, Combat Logic, Dynamic Camera, Guerrier Ninja (p1), main.gd, Mutant Cyborg (p2) (+2 more)

### Community 1 - "Web3 & Frontend Integration"
Cohesion: 0.38
Nodes (7): Godot 4, Godot Web3 Combat Game, JSBridge Communication, Metamask Wallet, Vanilla JS Frontend, Web3 Authentication, WebAssembly Export

### Community 2 - "Backend Infrastructure"
Cohesion: 0.33
Nodes (6): CORS Configuration, docker-compose.yml, Docker Infrastructure, Laravel API, MySQL Database, Nginx Server

### Community 3 - "Blender & Asset Pipeline"
Cohesion: 0.40
Nodes (5): Blender Pipeline, Character Integration Workflow, GLB 3D Models, MCP Protocol, Mixamo Pipeline

## Knowledge Gaps
- **13 isolated node(s):** `Animation State Machine`, `Combat Logic`, `Dynamic Camera`, `Mutant Cyborg (p2)`, `Tom Frazer (p3)` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Godot Web3 Combat Game` connect `Web3 & Frontend Integration` to `Backend Infrastructure`, `Blender & Asset Pipeline`?**
  _High betweenness centrality (0.195) - this node is a cross-community bridge._
- **Why does `Docker Infrastructure` connect `Backend Infrastructure` to `Web3 & Frontend Integration`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `Character Integration Workflow` connect `Blender & Asset Pipeline` to `Web3 & Frontend Integration`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **What connects `Animation State Machine`, `Combat Logic`, `Dynamic Camera` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._