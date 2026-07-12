import "./style.css";
import Papa from "papaparse";
import {
    Cosmograph,
    prepareCosmographData,
} from "@cosmograph/cosmograph";

// HTML
document.querySelector("#app").innerHTML = `
<div id="layout">
    <div id="legend">
        <div class="legend-item">
            <div class="legend-color exp"></div>
            Experience
        </div>
        <div class="legend-item">
            <div class="legend-color com"></div>
            Community
        </div>
        <div class="legend-item">
            <div class="legend-color emo"></div>
            Emotion
        </div>
    </div>
    <div id="cosmograph-container"></div>
    <div id="savedPanel">

    <h2>Saved Posts</h2>

    <ul id="savedList">

        <li>No saved posts</li>

    </ul>
</div>
`;


// CSV laden
async function loadCSV(path) {
    const response = await fetch(path);
    const text = await response.text();
    const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true
    });
    return parsed.data;
}


// Cosmograph Konfiguration
const dataConfig = {
    points: {
        pointIdBy: "id",
        pointLabelBy: "label",
        pointIncludeColumns: ["*"]
    },

    links: {
        linkSourceBy: "source",
        linkTargetsBy: ["target"]
    }
};


// Start
async function start() {
    const container =
        document.getElementById(
            "cosmograph-container"
        );

    const rawPoints =
        await loadCSV("/nodes.csv");
    
        const colors = {
            Experience: "#0068ad",        
            Community: "#F39C12",        
            Emotion: "#846ddfe1",            
        };
        
        rawPoints.forEach(point => {        
            point.color = colors[point.type];        
        });

    const rawLinks =
        await loadCSV("/edges.csv");

    const postsResponse = await fetch("/posts.json");

    console.log("Status:", postsResponse.status);
    console.log("Content-Type:", postsResponse.headers.get("content-type"));
        
    const text = await postsResponse.text();
        
    console.log(text);
    const {
        points,
        links,
        cosmographConfig
    } =
    await prepareCosmographData(
        dataConfig,
        rawPoints,
        rawLinks
    );

    const graph = new Cosmograph(
        container,
        {
            points,
            links,
            ...cosmographConfig,
            showLabels: true,
            showHoveredPointLabel: true,
            pointColorBy: "type",
            }
    );
    console.log(graph);
}
start();