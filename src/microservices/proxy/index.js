const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(morgan('combined'));
app.use(express.json());

const PORT = process.env.PORT || 8000;
const MONOLITH_URL = process.env.MONOLITH_URL || 'http://localhost:8080';
const MOVIES_SERVICE_URL = process.env.MOVIES_SERVICE_URL || 'http://localhost:8081';
const EVENTS_SERVICE_URL = process.env.EVENTS_SERVICE_URL || 'http://localhost:8082';
const GRADUAL_MIGRATION = process.env.GRADUAL_MIGRATION === 'true';
const MOVIES_MIGRATION_PERCENT = parseFloat(process.env.MOVIES_MIGRATION_PERCENT) || 0;

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

// Proxy для events-service
app.use('/api/events', createProxyMiddleware({
    target: EVENTS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/events': '/api/events' },
    onError: (err, req, res) => {
        console.error('Error proxying to events service:', err);
        res.status(502).json({ error: 'Cannot connect to events service' });
    }
}));

// Функция для определения куда перенаправлять запрос
const getMoviesServiceTarget = (req) => {
    if (!GRADUAL_MIGRATION) {
        return MOVIES_SERVICE_URL;
    }

    const random = Math.random() * 100;
    const useNewService = random < MOVIES_MIGRATION_PERCENT;

    console.log(`Request ${req.path} - migration chance: ${MOVIES_MIGRATION_PERCENT}%, random: ${random.toFixed(2)}, using ${useNewService ? 'NEW' : 'OLD'} service`);

    return useNewService ? MOVIES_SERVICE_URL : MONOLITH_URL;
};

// Proxy для movies с фиче-флагом
app.use('/api/movies', (req, res, next) => {
    const target = getMoviesServiceTarget(req);

    createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { '^/api/movies': '/api/movies' },
        onError: (err, req, res) => {
            console.error(`Error proxying to ${target}:`, err);
            res.status(502).json({ error: `Cannot connect to service at ${target}` });
        }
    })(req, res, next);
});

// Proxy для users
app.use('/api/users', createProxyMiddleware({
    target: MONOLITH_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/users': '/api/users' },
    onError: (err, req, res) => {
        console.error('Error proxying to monolith:', err);
        res.status(502).json({ error: 'Cannot connect to monolith' });
    }
}));

// Proxy для payments
app.use('/api/payments', createProxyMiddleware({
    target: MONOLITH_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/payments': '/api/payments' },
    onError: (err, req, res) => {
        console.error('Error proxying to monolith:', err);
        res.status(502).json({ error: 'Cannot connect to monolith' });
    }
}));

// Proxy для subscriptions
app.use('/api/subscriptions', createProxyMiddleware({
    target: MONOLITH_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/subscriptions': '/api/subscriptions' },
    onError: (err, req, res) => {
        console.error('Error proxying to monolith:', err);
        res.status(502).json({ error: 'Cannot connect to monolith' });
    }
}));

// Все остальные запросы идут в монолит
app.use('/', createProxyMiddleware({
    target: MONOLITH_URL,
    changeOrigin: true,
    onError: (err, req, res) => {
        console.error('Error proxying to monolith:', err);
        res.status(502).json({ error: 'Cannot connect to monolith' });
    }
}));

app.listen(PORT, () => {
    console.log(`Proxy service running on port ${PORT}`);
    console.log(`Gradual migration enabled: ${GRADUAL_MIGRATION}`);
    console.log(`Movies migration percent: ${MOVIES_MIGRATION_PERCENT}%`);
});

process.on('SIGINT', () => {
    console.log('Shutting down proxy service');
    process.exit(0);
});