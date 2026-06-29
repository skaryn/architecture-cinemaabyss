const express = require('express');
const { Kafka } = require('kafkajs');
const morgan = require('morgan');

const app = express();
app.use(morgan('combined'));
app.use(express.json());

const PORT = process.env.PORT || 8082;
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';

// Kafka клиент
const kafka = new Kafka({
    clientId: 'events-service',
    brokers: [KAFKA_BROKER]
});

// Producer и Consumer
const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'events-service-group' });

// Подключение к Kafka
const connectKafka = async () => {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: 'events', fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const event = JSON.parse(message.value.toString());
            console.log(`Processed event:`, {
                type: event.type,
                data: event.data,
                timestamp: new Date().toISOString()
            });
        },
    });

    console.log('Connected to Kafka');
};

connectKafka().catch(console.error);

// Health check
app.get('/api/events/health', (req, res) => {
    res.status(200).json({ status: true });
});

// Создание события
const createEvent = async (type, data) => {
    await producer.send({
        topic: 'events',
        messages: [
            { value: JSON.stringify({ type, data }) }
        ]
    });
};

// User event
app.post('/api/events/user', async (req, res) => {
    try {
        const eventData = req.body;
        await createEvent('user', eventData);
        res.status(201).json({ status: 'success' });
    } catch (err) {
        console.error('User event error:', err);
        res.status(500).json({ error: 'Failed to process user event' });
    }
});

// Movie event
app.post('/api/events/movie', async (req, res) => {
    try {
        const eventData = req.body;
        await createEvent('movie', eventData);
        res.status(201).json({ status: 'success' });
    } catch (err) {
        console.error('Movie event error:', err);
        res.status(500).json({ error: 'Failed to process movie event' });
    }
});

// Payment event
app.post('/api/events/payment', async (req, res) => {
    try {
        const eventData = req.body;
        await createEvent('payment', eventData);
        res.status(201).json({ status: 'success' });
    } catch (err) {
        console.error('Payment event error:', err);
        res.status(500).json({ error: 'Failed to process payment event' });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await producer.disconnect();
    await consumer.disconnect();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Events service running on port ${PORT}`);
});