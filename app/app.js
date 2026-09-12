const express = require('express');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok'
    });
});

app.listen(3000, () => {
    console.log('Servidor corriendo en puerto 3000');
});