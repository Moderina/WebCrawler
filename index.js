import express from "express";
import axios from "axios";
// import cheerio from "cheerio";
import { parse } from 'node-html-parser';
import fs from "fs";

const app = express();
app.use(express.json());
app.use(express.static("public"));

let csvRows = [];
let visited = new Set();
let startTime;

async function fetchPage(url) {
    const response = await axios.get(url, { timeout: 5000 });
    return response.data;
}

function extractLinks(html, baseUrl) {
    // const $ = cheerio.load(html);
    const html_page = parse(html);
    const links = [];

    // $("a").each((_, el) => {
    //     const href = $(el).attr("href");
    //     if (href && href.startsWith("http")) {
    //         links.push(href);
    //     }
    // });
    console.log(html_page)

    return links;
}

async function bfs(startUrl, maxDepth, timeLimit) {
    const root = { url: startUrl, depth: 0, children: [] };
    const queue = [root];

    while (queue.length) {
        if (Date.now() - startTime > timeLimit) break;

        const node = queue.shift();
        if (visited.has(node.url) || node.depth > maxDepth) continue;

        visited.add(node.url);

        try {
            const html = await fetchPage(node.url);
            const text = html.replace(/<[^>]*>/g, " ");
            csvRows.push({ url: node.url, text });

            const links = extractLinks(html);
            links.forEach(link => {
                const child = { url: link, depth: node.depth + 1, children: [] };
                node.children.push(child);
                queue.push(child);
            });
        } catch {}
    }

    return root;
}

async function dfs(node, maxDepth, timeLimit) {
    if (
        visited.has(node.url) ||
        node.depth > maxDepth ||
        Date.now() - startTime > timeLimit
    ) return;

    visited.add(node.url);

    try {
        const html = await fetchPage(node.url);
        const text = html.replace(/<[^>]*>/g, " ");
        csvRows.push({ url: node.url, text });

        const links = extractLinks(html);
        for (const link of links) {
            const child = { url: link, depth: node.depth + 1, children: [] };
            node.children.push(child);
            await dfs(child, maxDepth, timeLimit);
        }
    } catch {}
}

app.post("/crawl", async (req, res) => {
    const { startUrl, method, maxDepth, timeLimit } = req.body;

    visited.clear();
    csvRows = [];
    startTime = Date.now();

    let tree;

    if (method === "BFS") {
        tree = await bfs(startUrl, maxDepth, timeLimit * 1000);
    } else {
        tree = { url: startUrl, depth: 0, children: [] };
        await dfs(tree, maxDepth, timeLimit * 1000);
    }

    res.json(tree);
});

app.get("/csv", (req, res) => {
    let csv = "URL,TEXT\n";
    csvRows.forEach(r => {
        csv += `"${r.url}","${r.text.replace(/"/g, '""')}"\n`;
    });

    res.header("Content-Type", "text/csv");
    res.attachment("crawler.csv");
    res.send(csv);
});

app.listen(3000, () => {
    console.log("Server działa: http://localhost:3000");
});


const url = 'https://www.zsmonki.pl/';
const html = await fetchPage(url);
extractLinks(html);