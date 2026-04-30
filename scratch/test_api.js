async function test() {
    try {
        const res = await fetch('http://localhost:5000/api/artworks?page=1&limit=12');
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Fetch Error:', e);
    }
}
test();
