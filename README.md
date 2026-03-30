# 🌍 Spectraforte — Maps. Data. Insight.

**Spectraforte** is a powerful, browser-based geospatial web application for uploading, visualising, analysing, and sharing spatial data from anywhere on the web. Built with Leaflet.js, it integrates with QGIS, Google Earth Engine, and cloud storage for a complete GIS workflow.

🔗 **Live Site:** [https://OnasanyaDemilade.github.io/maxgis/](https://OnasanyaDemilade.github.io/maxgis/)

---

## ✨ Features

### 🗺️ Map & Basemaps
- 9 basemap options — CartoDB Voyager/Light/Dark/Dark Matter, OSM, ESRI Satellite/Topo/Ocean, Stamen Terrain
- Light & dark theme toggle with persistent preference
- Fullscreen mode, coordinate display, scale bar

### 📂 Data Import
- **Drag & drop** — GeoJSON, KML, GPX, CSV
- **URL loader** — paste any raw GeoJSON link
- **WMS layers** — connect to any OGC Web Map Service
- **GitHub integration** — auto-load all GeoJSON files from a repo folder
- **Google Drive** — load public GeoJSON files directly

### 📤 Multi-Format Export
- Export to **GeoJSON**, **KML** (Google Earth), **GPX** (GPS devices), **CSV** (spreadsheets)
- Export individual layers or all data at once
- Custom filename support

### 🛠️ Analysis Tools
- **Drawing** — marker, polyline, polygon, circle, rectangle
- **Measure** — click-to-measure distances (m/km)
- **Buffer** — create radius zones around point features
- **Centroid** — extract center points from polygons
- **Bounding Box** — generate extent rectangles
- **Choropleth** — classify any numeric field with colour ramp

### 📊 Data Dashboard
- Auto-generates charts from CSV/attribute data
- **Pie/Doughnut** — categorical distribution
- **Bar chart** — numeric averages by category
- **Histogram** — value distribution
- **Scatter plot** — field vs field comparison
- Summary statistics (count, average, sum)

### 🛰️ Google Earth Engine Integration
- **Land Use / Land Cover** classification
- **NDVI** vegetation index analysis
- **Flood vulnerability** assessment
- **Urban expansion** detection
- **Surface water** mapping
- Generates ready-to-run Python scripts for Google Colab
- Optional: connect your own GEE backend API

### ☁️ Cloud Storage
- Save layers to cloud (JSONBin.io — free, no account needed)
- Load data from shareable cloud links
- Google Drive public file support

### 🔗 Sharing
- **View link** — shares map position, basemap, and theme
- **Data link** — uploads layers and generates a link with full data
- **Embed code** — iframe snippet for websites and blogs

### 📋 Attribute Table
- Spreadsheet-style view of feature properties
- Sortable columns, per-layer selection

---

## 📁 Project Structure

```
maxgis/
├── index.html          # Landing page
├── app.html            # Main map application
├── netlify.toml        # Netlify deployment config
├── README.md
├── .gitignore
├── assets/
│   └── logo.png        # Spectraforte logo
├── css/
│   ├── theme.css       # Light/dark theme variables
│   ├── layout.css      # Structural positioning
│   └── components.css  # Buttons, forms, cards, grids
├── js/
│   ├── map.js          # Core map init, basemaps, UI wiring
│   ├── converters.js   # Format conversion (KML, GPX, CSV ↔ GeoJSON)
│   ├── layers.js       # Layer add/remove/style/attribute table
│   ├── tools.js        # Draw, measure, buffer, centroid, bbox
│   ├── export.js       # Multi-format export system
│   ├── dashboard.js    # Chart.js data visualisation
│   ├── storage.js      # Cloud storage & Google Drive
│   ├── gee.js          # Google Earth Engine integration
│   └── sharing.js      # Link sharing & embed generation
└── data/
    └── *.geojson       # Your spatial data files
```

---

## 🚀 Deployment

### GitHub Pages
1. Go to **Settings → Pages**
2. Source: **Deploy from branch** → `main` / `/ (root)`
3. Live at `https://your-username.github.io/maxgis/`

### Netlify
1. Go to [app.netlify.com](https://app.netlify.com)
2. **Add new site → Import from GitHub** → select `maxgis`
3. Publish directory: `.`
4. Auto-deploys on every `git push`

---

## 🔄 QGIS → Web Workflow

1. Style and prepare layers in **QGIS**
2. **Export** → Save Features As → **GeoJSON** → save to `data/` folder
3. Push to GitHub:
   ```bash
   git add .
   git commit -m "Added new layer"
   git push
   ```
4. Open MaxGIS → click **+ GitHub Repo** → enter your username & repo
5. All GeoJSON files load automatically

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl + F` | Open location search |
| `Esc` | Close modals, stop measuring |
| `F11` | Toggle fullscreen |

---

## 🧰 Tech Stack

- **[Leaflet.js](https://leafletjs.com/)** — interactive map engine
- **[Leaflet.Draw](https://leaflet.github.io/Leaflet.draw/)** — drawing tools
- **[Chart.js](https://www.chartjs.org/)** — dashboard visualisations
- **[Nominatim](https://nominatim.openstreetmap.org/)** — geocoding/search
- **[JSONBin.io](https://jsonbin.io/)** — free cloud storage
- **[Google Earth Engine](https://earthengine.google.com/)** — satellite analysis

---

## 📄 License

MIT License — free for personal and commercial use.

---

## 👤 Author

**Onasanya Demilade**

Built with ❤️ for the geospatial community.

*Spectraforte — Maps. Data. Insight.*
