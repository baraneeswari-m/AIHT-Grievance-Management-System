import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Resolve the server environment file relative to this module so startup does not
// depend on the directory from which Node was launched.
const serverEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: serverEnvPath });
