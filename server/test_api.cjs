const fetch = globalThis.fetch || require('node-fetch');

(async () => {
  const room = 'test_autoname_room';
  const testName = 'TesterX';
  try {
    const postRes = await fetch(`http://localhost:3000/api/rooms/${encodeURIComponent(room)}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'hello from API test', senderName: testName }),
    });
    const postData = await postRes.json();
    console.log('POST result:', postData);

    // wait a moment
    await new Promise((r) => setTimeout(r, 400));

    const res = await fetch(`http://localhost:3000/api/rooms/${encodeURIComponent(room)}/messages?limit=5`);
    const data = await res.json();
    console.log('GET messages:', JSON.stringify(data, null, 2));
    const last = data.messages && data.messages[data.messages.length-1];
    if (last) {
      console.log('Last message senderName:', last.senderName);
      process.exit(last.senderName === testName ? 0 : 2);
    } else {
      console.error('No messages returned');
      process.exit(3);
    }
  } catch (err) {
    console.error('Test failed', err.message);
    process.exit(4);
  }
})();
