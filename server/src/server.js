import './config/env.js';
import app from './app.js';
if(!process.env.DATABASE_URL||!process.env.JWT_SECRET){console.error('DATABASE_URL and JWT_SECRET must be configured in server/.env');process.exit(1);}
const port=process.env.PORT||4000; app.listen(port,()=>console.log(`CGMS API listening on http://localhost:${port}`));
