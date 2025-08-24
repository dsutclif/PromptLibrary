import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve demo files for the Chrome extension
  app.use('/demo', (req, res, next) => {
    if (req.path === '/' || req.path === '') {
      res.sendFile(path.resolve('demo/index.html'));
    } else {
      next();
    }
  });

  // Redirect root to demo
  app.get('/', (req, res) => {
    res.redirect('/demo');
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Chrome Extension Demo Server' });
  });

  const httpServer = createServer(app);

  return httpServer;
}
