const express = require('express');
const path = require('path');
const { parse } = require('node-html-parser');
const cloudscraper = require('cloudscraper')

const app = express();

app.use(express.json());
app.use(express.static(path.join(path.dirname(process.execPath), 'public')));

app.post("/crawl", async (req, res) => {
    const { startUrl, method, maxDepth, timeLimit, maxChildren } = req.body;
    max_children = maxChildren;
    time_limit = timeLimit*1000;

    //resetowanie
    visited = [];
    url_and_content = [];
    root = new TreeNode(startUrl);
    startTime = Date.now()

    if (method == 0) await bfs(root, maxDepth);
    else await dfs(root, 0, maxDepth-1);

    res.json({ visited: root });
});

app.get("/csv", async (req, res) => {
    const csv = generateCsv(url_and_content);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=pages.csv");
    res.send(csv);
});


class TreeNode {
    constructor(url) {
        this.url = url;
        this.children = [];
    }
}

let root = null; //root drzewa przeszukiwania
let visited = []; //zeby duplikatow nie przeszukiwalo
let url_and_content = []; //tylko dla csv
let max_children = 10; //ile max dzieci rodzica ma przeszukac dalej (optymalizacja :P)
let startTime;
let time_limit = 5;



//pobieranie contentu strony
async function fetchPage(url) {
    try {
        const html = await cloudscraper.get(url, {timeout: 5000});
        return html;

    } catch (err) {
        return null; 
    }
}


function extractText(html) {
    const content = parse(html);

    const unwantedTags = content.querySelectorAll("script, style, noscript");
    unwantedTags.forEach(tag => tag.remove());

    const body = content.querySelector("body");
    if (!body) return "";

    return body.textContent.replace(/\s+/g, " ").trim();
}

function extractLinks(url, html) {
    const html_page = parse(html);
    const links = [];

    html_page.querySelectorAll("a").forEach(a => {
        const href = a.getAttribute("href");
        if (href && href.startsWith("http")) {
            links.push(href);
        }
    });
    return links;
}

async function dfs(parentNode, depth, maxDepth) {

    if (depth > maxDepth || Date.now() - startTime > time_limit) 
        return;

    visited.push(parentNode.url);

    // try {
        const page_content = await fetchPage(parentNode.url);
        if (!page_content) return;
        url_and_content.push({ url: parentNode.url, content: extractText(page_content)})

        const links = extractLinks(parentNode.url, page_content);
        var i = 0;
        for (const link of links) {
            if (visited.includes(link)) {
                continue;
            }
            const node = new TreeNode(link);
            parentNode.children.push(node);

            //ograniczenie: jezeli ma przegladac tylko N dzieci, jak 0 to wszsytkie przeglada
            if (i >= max_children && max_children != 0)  break;
            i++

            await dfs(node, depth+1, maxDepth);
        }
    // } catch {}
}

async function bfs(rootNode, maxDepth) {
    const queue = [];
    queue.push({ node: rootNode, depth: 0 });

    visited.push(rootNode.url);

    while (queue.length > 0) {
        if (Date.now() - startTime > time_limit) break;

        const { node, depth } = queue.shift();

        if (depth >= maxDepth) continue;

        try {
            const html = await fetchPage(node.url);
            if (!html) return;
            url_and_content.push({ url: node.url, content: extractText(html)})

            const links = extractLinks(node.url, html);

            let i = 0;
            for (const link of links) {
                if (visited.includes(link)) continue;

                const child = new TreeNode(link);
                node.children.push(child);
                visited.push(link);

                queue.push({ node: child, depth: depth + 1 });

                if (i >= max_children && max_children !== 0) break;
                i++;
            }
        } catch {}
    }
}

function escapeCsvField(str) {
  if (!str) return "";
  return `"${str.replace(/"/g, '""')}"`;
}

function generateCsv() {
  const header = "url,content\n";

  const body = url_and_content.map(row => {
    return `${escapeCsvField(row.url)},${escapeCsvField(row.content)}`;
  }).join("\n");

  return header + body;
}

app.listen(3000, () => {
    console.log("http://localhost:3000")
    console.log("^ Open browser with that address");
    console.log("Ctrl + C or close window to stop app");
    }
);