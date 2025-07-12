import express from 'express';
import { createLogger } from '../src/collectors/logger';

// Initialize the logger
const logger = createLogger({
  service: 'example-app',
  environment: process.env.NODE_ENV || 'development',
  apiEndpoint: process.env.LOG_API_ENDPOINT || 'http://localhost:3000',
  apiToken: process.env.LOG_API_TOKEN || 'your-api-token',
  sentryDsn: process.env.SENTRY_DSN,
  enableConsole: true,
  logLevel: 'debug',
});

// Create Express app
const app = express();
app.use(express.json());

// Add logging middleware
app.use(logger.expressMiddleware());

// Example routes
app.get('/', (req, res) => {
  req.logger.info('Home page accessed');
  res.json({ message: 'Welcome to the example app!' });
});

app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;
  
  // Set context for this request
  req.logger.setContext({ userId });
  
  try {
    // Simulate fetching user with timing
    const user = await req.logger.wrapAsync('fetch-user', async () => {
      // Simulate database query
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (userId === '999') {
        throw new Error('User not found');
      }
      
      return {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
      };
    });
    
    req.logger.info('User fetched successfully', { user });
    res.json(user);
  } catch (error) {
    req.logger.error('Failed to fetch user', error as Error);
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/data', (req, res) => {
  const timer = req.logger.startTimer('process-data');
  
  try {
    // Validate input
    if (!req.body.data) {
      req.logger.warn('Invalid request: missing data field');
      return res.status(400).json({ error: 'Data field is required' });
    }
    
    // Process data
    const processedData = req.body.data.toUpperCase();
    
    // Log metrics
    req.logger.metric('data_processing_size', req.body.data.length, {
      method: 'uppercase',
    });
    
    timer(); // Log duration
    
    req.logger.info('Data processed successfully', {
      originalLength: req.body.data.length,
      processedLength: processedData.length,
    });
    
    res.json({ processed: processedData });
  } catch (error) {
    timer();
    req.logger.error('Data processing failed', error as Error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

// Simulate various log levels
app.get('/test-logs', (req, res) => {
  req.logger.debug('Debug message', { debugInfo: 'detailed debug data' });
  req.logger.info('Info message', { action: 'test-logs' });
  req.logger.warn('Warning message', { warning: 'This is a warning' });
  req.logger.error('Error message', new Error('Test error'), { 
    errorCode: 'TEST_ERROR' 
  });
  
  res.json({ message: 'Test logs generated' });
});

// Database operation example
app.get('/db-test', async (req, res) => {
  const queryStart = Date.now();
  
  try {
    // Simulate database query
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const duration = Date.now() - queryStart;
    req.logger.database('SELECT', 'SELECT * FROM users WHERE active = true', duration, {
      rowCount: 42,
    });
    
    res.json({ users: 42 });
  } catch (error) {
    const duration = Date.now() - queryStart;
    req.logger.database('SELECT', 'SELECT * FROM users WHERE active = true', duration, {
      error: (error as Error).message,
    });
    res.status(500).json({ error: 'Database error' });
  }
});

// Error handler
app.use((err: Error, req: any, res: any, next: any) => {
  req.logger.error('Unhandled error', err, {
    path: req.path,
    method: req.method,
  });
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  logger.info(`Example app started on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
  });
});

// Simulate periodic background task
setInterval(() => {
  const taskLogger = logger.child({ task: 'cleanup' });
  
  taskLogger.info('Running cleanup task');
  
  // Simulate task with random success/failure
  if (Math.random() > 0.8) {
    taskLogger.error('Cleanup task failed', new Error('Disk full'));
  } else {
    taskLogger.info('Cleanup task completed', {
      filesDeleted: Math.floor(Math.random() * 100),
    });
  }
}, 30000); // Every 30 seconds

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Shutting down application');
  await logger.shutdown();
  process.exit(0);
});