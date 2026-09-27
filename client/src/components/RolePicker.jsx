import{Building2,ClipboardList,GraduationCap,ShieldCheck}from'lucide-react';
export const ACCOUNT_ROLES=[
 {value:'STUDENT',label:'Student',description:'Submit and track your grievances.',Icon:GraduationCap},
 {value:'OFFICER',label:'Officer',description:'Manage assigned grievances and update their status.',Icon:ClipboardList},
 {value:'DEPARTMENT_ADMIN',label:'Department Admin',description:'Manage grievances within your department.',Icon:Building2},
 {value:'SUPER_ADMIN',label:'Super Admin',description:'Manage the complete grievance system.',Icon:ShieldCheck}
];
export default function RolePicker({value,onChange,label}){return <fieldset className="role-picker"><legend>{label}</legend><div className="role-grid">{ACCOUNT_ROLES.map(({value:role,label:roleLabel,description,Icon})=><button type="button" key={role} role="radio" aria-checked={value===role} className={`role-option ${value===role?'role-option-selected':''}`} onClick={()=>onChange(role)}><Icon size={19}/><span className="role-option-copy"><b>{roleLabel}</b><small>{description}</small></span>{value===role&&<span className="role-check" aria-hidden="true">✓</span>}</button>)}</div></fieldset>}
