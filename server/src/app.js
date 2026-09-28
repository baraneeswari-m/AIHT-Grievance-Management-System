import './config/env.js';
import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit';
import routes from './routes/api.js'; import {errorHandler,notFound} from './middleware/errors.js';
const app=express();
// Render forwards one trusted proxy hop and supplies X-Forwarded-For. Set this
// before rate-limit middleware reads req.ip.
app.set('trust proxy', 1);
app.use(helmet()); app.use(cors({origin:process.env.CLIENT_URL||'http://localhost:5173'})); app.use(express.json({limit:'1mb'})); app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:100,standardHeaders:true,legacyHeaders:false})); app.use('/api',routes); app.use(notFound); app.use(errorHandler); export default app;
