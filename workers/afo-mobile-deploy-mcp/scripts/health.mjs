const url = process.argv[2] || "http://127.0.0.1:8787/health";
const res = await fetch(url);
console.log(res.status, await res.text());
