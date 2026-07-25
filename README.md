# 🏙️ RESILIO CITY — AI-Powered Infrastructure Resilience Platform

> **Hackathon Project** — AI-Powered 3D Smart City Infrastructure Resilience & Disaster Planning Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.139-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![deck.gl](https://img.shields.io/badge/deck.gl-9.3-blue)](https://deck.gl/)
[![OR-Tools](https://img.shields.io/badge/OR--Tools-9.15-orange)](https://developers.google.com/optimization)

---

## ✨ Features

| Layer | Feature |
|-------|---------|
| 🏙️ **City Generation** | 5 pre-built synthetic cities (Nova Delhi, Cyber Bangalore, Coastal Mumbai, Heritage Jaipur, Techno Hyderabad) with 1000+ named roads |
| 🗺️ **3D Map View** | deck.gl-powered interactive road network with RCI color-coding (Green → Yellow → Orange → Red) |
| ⚡ **Hazard Engine** | 6 disaster types (Flood, Earthquake, Cyclone, Landslide, Heatwave, Industrial) with adjustable intensity |
| 🏗️ **3D Road Simulation** | Click any road → isometric multi-station cross-section, depth layers, aerial plan, elevation profile |
| 🧠 **AI Budget Optimizer** | Google OR-Tools knapsack solver for budget-constrained resilience upgrades |
| 📊 **Analytics Dashboard** | Real-time RCI distribution, simulation timeline, network health metrics |

---

## 🏗️ Architecture

```
hackathon-city-resilience/
├── backend/                    # FastAPI Python API
│   ├── main.py                 # Router + global state
│   └── engine/
│       ├── cities.py           # 5 pre-defined synthetic cities with named roads
│       ├── generator.py        # Legacy procedural city generator
│       ├── hazard.py           # Failure probability engine
│       ├── graph_intelligence.py # NetworkX centrality + RCI computation
│       ├── simulation.py       # Cascading failure simulation
│       └── optimization.py     # OR-Tools knapsack budget optimizer
│
└── frontend/                   # React + TypeScript + Vite
    └── src/
        ├── App.tsx             # Router (Landing ↔ MapView)
        ├── pages/
        │   ├── Landing.tsx     # City selector + health dashboard
        │   └── MapView.tsx     # 3D deck.gl map + analytics
        └── components/
            └── RoadModal.tsx   # 3D road simulation (Canvas)
```

---

## 🚀 Quick Start

### Backend (FastAPI)

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate        # Windows
# source venv/bin/activate     # Linux/Mac

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/cities` | List all 5 pre-defined cities with health stats |
| `GET` | `/cities/{city_id}/load` | Load & generate a city network |
| `GET` | `/city` | Get GeoJSON road network |
| `GET` | `/city/analysis` | Get network health metrics |
| `GET` | `/city/road/{road_id}` | Get detailed road info |
| `POST` | `/city/disaster` | Run disaster simulation |
| `POST` | `/city/optimize` | Run OR-Tools budget optimizer |

---

## 🗺️ Cities Available

| ID | City | Theme | Center |
|----|------|-------|--------|
| `nova_delhi` | 🏛️ Nova Delhi | Cyan | 28.61°N, 77.20°E |
| `cyber_bangalore` | 🖥️ Cyber Bangalore | Green | 12.97°N, 77.59°E |
| `coastal_mumbai` | 🌊 Coastal Mumbai | Pink | 19.07°N, 72.87°E |
| `heritage_jaipur` | 🏰 Heritage Jaipur | Amber | 26.91°N, 75.78°E |
| `techno_hyderabad` | 💎 Techno Hyderabad | Purple | 17.38°N, 78.48°E |

---

## 🧠 Technical Stack

**Backend:**
- `FastAPI` — High-performance async API framework
- `NetworkX` — Graph analysis, edge betweenness centrality
- `OR-Tools` — Google combinatorial optimization (knapsack solver)
- `SciPy` — Scientific computing for hazard models
- `NumPy` — Numerical operations

**Frontend:**
- `React 19` + `TypeScript` + `Vite`
- `deck.gl 9.3` — WebGL-powered geospatial visualization
- `HTML Canvas 2D` — Isometric 3D road simulation renderer
- `Recharts` — Analytics charts
- `Axios` — HTTP client

---

## 📸 Screenshots

### Landing Dashboard
City selector with infrastructure health metrics, RCI indicators, and budget utilization.

### 3D Map View
Interactive road network with color-coded RCI (Green=Excellent, Red=Critical). Click any road to open simulation.

### 3D Road Simulation
4 viewing modes:
- **Station Views** — Isometric multi-station cross-sections with terrain and pavement layers
- **Cross-Section** — Depth profile showing all 5 pavement layers with measurements
- **Aerial Plan** — Top-down view with animated critical point radar
- **Elevation Profile** — Road alignment with terrain elevation chart

---

## 📝 License

MIT — Built for hackathon demonstration purposes.

---

*Built with ❤️ for smart city resilience planning*
