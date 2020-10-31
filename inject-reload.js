(() => {
    if (!('WebSocket' in window)) {
        console.error('cannot connect with reload server because websockets are not available');
    }

    const connect = () => {
        const ws = new WebSocket('ws://localhost:__PORT__');
        ws.addEventListener('open', () =>{
            console.log('Reload server connected');
        });
        ws.addEventListener('message', e => {
            const msg = e.data;

            if (msg === 'reload') {
                location.reload();
            }
        });
        const reconnect = () => {
            console.log('Reload server closed, trying to reconnect');
            setTimeout(() => {
                connect();
            }, 300);
        };
        ws.addEventListener('close', reconnect);
        ws.addEventListener('error',reconnect);
    };
    connect();
})();