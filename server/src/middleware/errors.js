import { ZodError } from 'zod';
export function notFound(req,res){ res.status(404).json({error:'Route not found'}); }
function redactSensitive(text,req){
  let result=String(text??'');
  const secrets=[process.env.DATABASE_URL,process.env.JWT_SECRET,process.env.SMTP_PASSWORD,process.env.SMTP_USER,req.body?.password,req.body?.confirmPassword,req.body?.currentPassword,req.body?.newPassword,(req.headers.authorization||'').replace(/^Bearer\s+/i,'')].filter(value=>typeof value==='string'&&value.length>0);
  for(const secret of secrets)result=result.replaceAll(secret,'[REDACTED]');
  return result
    .replace(/(?:postgres(?:ql)?|mysql):\/\/[^\s"'`]+/gi,'[DATABASE_URL REDACTED]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s"'`]+/gi,'$1[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[JWT REDACTED]')
    .replace(/\b(DATABASE_URL|JWT_SECRET|SMTP_PASSWORD)\s*[:=]\s*[^\s,"'`]+/gi,'$1=[REDACTED]');
}
export function errorHandler(err,req,res,next){
  const status=err.status||500;
  if(status>=500){
    console.error('[api] Request failed.',{
      method:req.method,path:req.path,status,code:err.code||'INTERNAL_ERROR',
      message:redactSensitive(err.message,req),
      stack:redactSensitive(err.stack||'',req)
    });
  }else console.warn('[api] Request rejected.',{method:req.method,path:req.path,status});
  if(err instanceof ZodError)return res.status(400).json({error:'Validation failed',details:err.flatten().fieldErrors});
  if(err.code==='P2002'){const target=Array.isArray(err.meta?.target)?err.meta.target.map(String):[String(err.meta?.target||'')];const field=target.some(v=>v.toLowerCase().includes('email'))?'email':target.some(v=>v.toLowerCase().includes('studentid'))?'student ID':null;return res.status(409).json({error:field?`An account with this ${field} already exists.`:'A record with this value already exists.'});}
  res.status(status).json({error:status===500?'An unexpected server error occurred.':err.message});
}
