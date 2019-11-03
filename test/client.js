const EventSource = require('eventsource');

// The subscriber subscribes to updates for the https://example.com/foo topic
// and to any topic matching https://example.com/books/{name}
const url = new URL('http://localhost:3000/.well-known/mercure');
url.searchParams.append('topic', 'http://localhost:3000/books/{id}');
url.searchParams.append('topic', 'http://localhost:3000/users/dunglas');

const eventSource = new EventSource(url.toString(), {
  headers: {
    Cookie: 'mercureAuthorization=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZXJjdXJlIjp7InB1Ymxpc2giOlsiaHR0cDovL2xvY2FsaG9zdDozMDAwL2Jvb2tzL3tpZH0iXSwic3Vic2NyaWJlIjpbImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9ib29rcy97aWR9Il19fQ.uTSaEacmjvpfb3qCzRnv5lWkVLVMLpskt54UgDwoauA',
    'Last-Event-ID': 'bbb458bb-814a-4d25-9dc7-6c8369593584',
  }
});
console.log(`Connected to ${eventSource.url}`);

eventSource.onmessage = (data) => console.log(data);
eventSource.onerror = (err) => console.error(err);

console.log('Waiting ..');
