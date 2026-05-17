import React, { useState, useEffect, useCallback } from 'react'
import {
  Activity, CheckCircle, GitBranch, Globe, Lock,
  Rocket, Server, Zap, Play, RefreshCw, X, Brain, Shield,
  Bell, RotateCcw, BookOpen, Filter, Search, Database,
  MessageSquare, BarChart3, Terminal, ChevronRight, Radio,
  TrendingUp, Cpu
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

// ─── Design tokens ────────────────────────────────────────────────────────────
const G = {
  neon:   '#00ff88',
  bright: '#39ff8e',
  dim:    '#0d4a28',
  bg0: '#020a04', bg1: '#050f07', bg2: '#081408', bg3: '#0a1a0b', bg4: '#0d2010',
  b1: '#0f2a12',  b2: '#163d1a',  b3: '#1e5225',
  t1: '#e8fced',  t2: '#a3d4a8',  t3: '#5a8f60',  t4: '#2e5433',
  g300: '#86efac', g400: '#4ade80', g500: '#22c55e',
  red: '#ff3b3b', orange: '#ff8c00', yellow: '#ffd600', blue: '#00b4ff', purple: '#b06aff',
} as const

// ─── Types ────────────────────────────────────────────────────────────────────
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'
type Status   = 'OPEN' | 'INVESTIGATING' | 'MITIGATED' | 'ESCALATED' | 'RESOLVED'
type Source   = 'GITHUB' | 'MANUAL' | 'MONITORING'
type Category = 'DEPLOYMENT' | 'INFRASTRUCTURE' | 'SECURITY' | 'PERFORMANCE' | 'DATABASE' | 'NETWORK' | 'APPLICATION'
type Tab      = 'incidents' | 'analytics' | 'workflow' | 'knowledge'

interface AIData {
  summary: string; priority_score: number; recommended_team: string
  root_cause_hypothesis: string; recommended_actions: string[]
  requires_rollback: boolean; rollback_target: string; rollback_confidence: number
  escalate_to_oncall: boolean; estimated_resolution_min: number
  confidence: number; tags: string[]; similar_fix: string | null; used_fallback: boolean
}

interface Ticket {
  ticket_id: string; title: string; description: string
  source: Source; severity: Severity; category: Category
  environment: string; cluster: string; namespace: string
  affected_services: string[]; status: Status
  jira_issue_key: string | null; jira_url: string | null
  sla_deadline: string; escalation_deadline: string
  reporter: { name: string; email: string; team: string }
  ai: AIData
  data_quality: { missing_fields: string[]; completeness_score: number }
  workflow_actions: { jira_created: boolean; slack_notified: boolean; rollback_requested: boolean; rollback_executed: boolean }
  ingested_at: string; kb_similar_count: number
}

// ─── Config maps ─────────────────────────────────────────────────────────────
const SEV_CFG: Record<Severity, { color: string; pulse: boolean }> = {
  CRITICAL: { color: G.red,    pulse: true  },
  HIGH:     { color: G.orange, pulse: false },
  MEDIUM:   { color: G.yellow, pulse: false },
  LOW:      { color: G.blue,   pulse: false },
  INFO:     { color: G.t3,     pulse: false },
}
const STA_CFG: Record<Status, { color: string; label: string }> = {
  OPEN:          { color: G.red,    label: 'OPEN'          },
  INVESTIGATING: { color: G.orange, label: 'INVESTIGATING' },
  MITIGATED:     { color: G.yellow, label: 'MITIGATED'     },
  ESCALATED:     { color: G.purple, label: 'ESCALATED'     },
  RESOLVED:      { color: G.neon,   label: 'RESOLVED'      },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const rng  = (a: number, b: number) => Math.floor(Math.random() * (b - a)) + a
const uid  = () => `TKT-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.random().toString(36).slice(2,5).toUpperCase()}`
const SVCS = ['api-service','auth-service','frontend','worker','payment-service','notif-service','gateway','scheduler']

function makeMock(override: Partial<Ticket> = {}): Ticket {
  const sev  = (override.severity || pick(['CRITICAL','HIGH','HIGH','MEDIUM','MEDIUM','MEDIUM','LOW'])) as Severity
  const cat  = (override.category || pick(['DEPLOYMENT','INFRASTRUCTURE','PERFORMANCE','DATABASE','SECURITY','NETWORK','APPLICATION'])) as Category
  const src  = (override.source   || pick(['GITHUB','MONITORING','MONITORING','MANUAL','GITHUB'])) as Source
  const svc  = pick(SVCS)
  const now  = Date.now()
  const slaH = ({ CRITICAL:1, HIGH:4, MEDIUM:24, LOW:72, INFO:168 } as Record<string,number>)[sev] || 24
  const score = ({ CRITICAL:rng(90,100), HIGH:rng(70,89), MEDIUM:rng(40,69), LOW:rng(10,39), INFO:rng(1,15) } as Record<string,number>)[sev]
  const rb   = cat === 'DEPLOYMENT' && sev !== 'LOW' && Math.random() > 0.4

  const titles: Record<Category, string> = {
    DEPLOYMENT:     `[CI/CD] Deploy failure — ${svc} on ${pick(['main','master','release/v2'])}`,
    INFRASTRUCTURE: `K8s CrashLoopBackOff — ${svc} in ${pick(['production','staging'])} ns`,
    PERFORMANCE:    `High latency on ${svc} — p99 > ${rng(2,8)}s (threshold: 500ms)`,
    DATABASE:       `Connection pool exhausted — ${pick(['postgres','redis','mongo'])} @ 100%`,
    SECURITY:       `SSL cert expiry — ${pick(['api','auth','dash'])}.company.com (${rng(1,5)}d left)`,
    NETWORK:        `DNS resolution failure — ${svc} unreachable from ${rng(2,6)} pods`,
    APPLICATION:    `${rng(20,95)}% 500 error rate spike on ${svc}`,
  }

  return {
    ticket_id: uid(), title: titles[cat],
    description: `Automated detection from ${src}. Triage required.`,
    source: src, severity: sev, category: cat,
    environment: pick(['production','production','staging']),
    cluster: 'prod-cluster', namespace: pick(['default','production','api','workers']),
    affected_services: [svc, pick(SVCS)].filter((v,i,a)=>a.indexOf(v)===i),
    status: pick(['OPEN','OPEN','INVESTIGATING','MITIGATED']) as Status,
    jira_issue_key: `DEVOPS-${rng(100,9999)}`,
    jira_url: `https://company.atlassian.net/browse/DEVOPS-${rng(100,9999)}`,
    sla_deadline: new Date(now + slaH * 3600000).toISOString(),
    escalation_deadline: new Date(now + 30 * 60000).toISOString(),
    reporter: { name: pick(['SRE Bot','Datadog','GitHub Actions','Jane Smith']), email:'sre@co.com', team:'platform-sre' },
    ai: {
      summary: `${cat} incident in production. Priority ${score}/100. ${sev==='CRITICAL'?'Immediate escalation required.':'Investigation needed.'}`,
      priority_score: score, recommended_team: pick(['platform-sre','backend-eng','security-team','database-ops']),
      root_cause_hypothesis: `Recent ${cat.toLowerCase()} change likely caused this. Review last 2h of changes to ${svc}.`,
      recommended_actions: [
        `Check ${svc} logs for stack traces and error patterns`,
        'Review deployments in the last 2 hours',
        'Monitor error rates and key SLIs in Datadog',
        rb ? 'Prepare rollback to previous stable version' : 'Page on-call if situation degrades',
        'Add stakeholder update to Jira ticket',
      ],
      requires_rollback: rb, rollback_target: rb ? svc : '',
      rollback_confidence: rb ? Math.random()*0.4+0.6 : 0,
      escalate_to_oncall: sev==='CRITICAL',
      estimated_resolution_min: rng(15,120),
      confidence: Math.random()*0.3+0.7,
      tags: [cat.toLowerCase(), sev.toLowerCase(), 'automated', src.toLowerCase()],
      similar_fix: Math.random()>0.5 ? `kubectl rollout undo deployment/${svc} -n production` : null,
      used_fallback: false,
    },
    data_quality: { missing_fields: Math.random()>0.8?['severity','category']:[], completeness_score: rng(80,100) },
    workflow_actions: { jira_created:true, slack_notified:true, rollback_requested:rb, rollback_executed:false },
    ingested_at: new Date(now - rng(0,7200000)).toISOString(),
    kb_similar_count: rng(0,4),
    ...override,
  }
}

const SEED_TICKETS = Array.from({length:14}, ()=>makeMock())

// ─── Primitive UI components ──────────────────────────────────────────────────
const Tag: React.FC<{label:string; color:string; pulse?:boolean; size?:'sm'|'md'}> =
  ({label, color, pulse, size='sm'}) => (
  <span style={{
    display:'inline-flex', alignItems:'center', gap:5,
    background:`${color}12`, color, border:`1px solid ${color}40`,
    padding: size==='md'?'3px 10px':'2px 7px',
    borderRadius:3, fontSize: size==='md'?11:9, fontWeight:700,
    letterSpacing:'0.08em', fontFamily:"'Share Tech Mono',monospace",
    textTransform:'uppercase', boxShadow: pulse?`0 0 8px ${color}44`:'none',
  }}>
    {pulse && <span style={{width:5,height:5,borderRadius:'50%',background:color,animation:'blink 1.3s infinite'}}/>}
    {label}
  </span>
)

const InfoRow: React.FC<{label:string; value:string; mono?:boolean; accent?:string}> =
  ({label, value, mono, accent}) => (
  <div style={{marginBottom:5, display:'flex', gap:8, flexWrap:'wrap'}}>
    <span style={{fontSize:9, color:G.t4, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', fontFamily:"'Share Tech Mono',monospace", flexShrink:0}}>{label}:</span>
    <span style={{fontSize:11, color:accent||G.t2, fontFamily: mono?"'Share Tech Mono',monospace":"'Exo 2',sans-serif"}}>{value}</span>
  </div>
)

const MiniMetric: React.FC<{label:string; value:string; color:string}> = ({label,value,color}) => (
  <div style={{background:G.bg3, borderRadius:5, padding:'8px 10px', border:`1px solid ${G.b2}`, textAlign:'center'}}>
    <div style={{fontSize:9, color:G.t4, marginBottom:3, letterSpacing:'0.07em'}}>{label}</div>
    <div style={{fontSize:17, fontWeight:700, color, fontFamily:"'Share Tech Mono',monospace", textShadow:`0 0 10px ${color}66`}}>{value}</div>
  </div>
)

const SectionBox: React.FC<{title:string; accent?:string; children:React.ReactNode}> =
  ({title, accent=G.neon, children}) => (
  <div style={{background:G.bg2, border:`1px solid ${G.b2}`, borderRadius:6, padding:14, marginBottom:12}}>
    <div style={{fontSize:9, fontWeight:700, color:accent, letterSpacing:'0.12em', marginBottom:10, fontFamily:"'Share Tech Mono',monospace", display:'flex', alignItems:'center', gap:6}}>
      <span style={{width:12, height:1, background:accent, display:'inline-block'}}/>
      {title}
      <span style={{width:12, height:1, background:accent, display:'inline-block'}}/>
    </div>
    {children}
  </div>
)

const BarRow: React.FC<{label:string; count:number; total:number; color:string}> = ({label,count,total,color}) => {
  const pct = total>0 ? Math.round((count/total)*100) : 0
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:3}}>
        <span style={{fontSize:9, color:G.t3, fontFamily:"'Share Tech Mono',monospace"}}>{label}</span>
        <span style={{fontSize:10, fontWeight:700, color, fontFamily:"'Share Tech Mono',monospace"}}>{count}</span>
      </div>
      <div style={{height:3, background:G.b1, borderRadius:2, overflow:'hidden'}}>
        <div style={{height:'100%', width:`${pct}%`, background:color, borderRadius:2, transition:'width 0.6s ease', boxShadow:`0 0 6px ${color}88`}}/>
      </div>
    </div>
  )
}

// ─── Category icon helper ─────────────────────────────────────────────────────
const CatIcon: React.FC<{cat:Category; size:number; color:string}> = ({cat, size, color}) => {
  if (cat==='DEPLOYMENT')     return <Rocket size={size} color={color}/>
  if (cat==='INFRASTRUCTURE') return <Server size={size} color={color}/>
  if (cat==='SECURITY')       return <Lock size={size} color={color}/>
  if (cat==='PERFORMANCE')    return <Zap size={size} color={color}/>
  if (cat==='DATABASE')       return <Database size={size} color={color}/>
  if (cat==='NETWORK')        return <Globe size={size} color={color}/>
  return <Brain size={size} color={color}/>
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────
const TicketCard: React.FC<{ticket:Ticket; onClick:()=>void; isNew?:boolean}> = ({ticket,onClick,isNew}) => {
  const sev = SEV_CFG[ticket.severity]
  const sta = STA_CFG[ticket.status]
  const mins = Math.round((Date.now()-new Date(ticket.ingested_at).getTime())/60000)
  const age  = mins<60?`${mins}m`:`${Math.round(mins/60)}h`
  const slaBreached = new Date() > new Date(ticket.sla_deadline) && ticket.status!=='RESOLVED'

  return (
    <div
      onClick={onClick}
      style={{
        background: G.bg2, border:`1px solid ${isNew?sev.color:G.b2}`,
        borderLeft:`3px solid ${sev.color}`, borderRadius:6,
        padding:'11px 14px', cursor:'pointer', marginBottom:6,
        transition:'all 0.15s ease',
        animation: isNew?'slideDown 0.35s ease':undefined,
        boxShadow: isNew?`0 0 18px ${sev.color}33`:undefined,
        position:'relative',
      }}
      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=G.bg3;(e.currentTarget as HTMLElement).style.borderColor=G.b3}}
      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=G.bg2;(e.currentTarget as HTMLElement).style.borderColor=isNew?sev.color:G.b2}}
    >
      {slaBreached && (
        <div style={{position:'absolute',top:0,right:0,background:`${G.red}22`,color:G.red,fontSize:8,padding:'2px 6px',borderRadius:'0 6px 0 4px',fontFamily:"'Share Tech Mono',monospace",letterSpacing:'0.08em'}}>
          SLA BREACH
        </div>
      )}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8}}>
        <div style={{flex:1, minWidth:0}}>
          <div style={{display:'flex', flexWrap:'wrap', gap:4, marginBottom:6}}>
            <Tag label={ticket.severity} color={sev.color} pulse={sev.pulse}/>
            <Tag label={ticket.category} color={G.t3}/>
            <Tag label={sta.label} color={sta.color}/>
            {ticket.ai.requires_rollback && <Tag label="ROLLBACK" color={G.purple}/>}
            {ticket.data_quality.missing_fields.length>0 && <Tag label="INCOMPLETE" color={G.yellow}/>}
          </div>
          <div style={{fontSize:12, fontWeight:600, color:G.t1, marginBottom:5, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis', fontFamily:"'Exo 2',sans-serif"}}>
            {ticket.title}
          </div>
          <div style={{display:'flex', alignItems:'center', gap:10, fontSize:10, color:G.t4, flexWrap:'wrap', fontFamily:"'Share Tech Mono',monospace"}}>
            <span style={{display:'flex',alignItems:'center',gap:3}}>
              <CatIcon cat={ticket.category} size={9} color={G.t3}/>
              {ticket.source}
            </span>
            <span>SCORE: <strong style={{color:sev.color}}>{ticket.ai.priority_score}</strong></span>
            <span>{ticket.affected_services.slice(0,2).join(', ')}</span>
            <span style={{marginLeft:'auto',color:G.t4}}>{age} ago</span>
          </div>
        </div>
        <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0}}>
          <span style={{fontSize:9, color:G.t4, fontFamily:"'Share Tech Mono',monospace"}}>{ticket.ticket_id}</span>
          {ticket.jira_issue_key && <span style={{fontSize:9, color:G.g500, fontFamily:"'Share Tech Mono',monospace"}}>{ticket.jira_issue_key}</span>}
          <div style={{display:'flex', gap:4, marginTop:2}}>
            {ticket.workflow_actions.jira_created     && <CheckCircle size={11} color={G.neon}/>}
            {ticket.workflow_actions.slack_notified   && <MessageSquare size={11} color={G.neon}/>}
            {ticket.workflow_actions.rollback_requested&&<RotateCcw size={11} color={G.purple}/>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
const DetailPanel: React.FC<{ticket:Ticket; onClose:()=>void; onStatus:(id:string,s:Status)=>void}> =
  ({ticket, onClose, onStatus}) => {
  const sev = SEV_CFG[ticket.severity]
  return (
    <div style={{
      position:'fixed', right:0, top:0, bottom:0, width:490,
      background:G.bg1, borderLeft:`1px solid ${G.b2}`,
      overflowY:'auto', zIndex:60, padding:20,
      boxShadow:'-20px 0 60px rgba(0,0,0,0.7)', animation:'slideRight 0.25s ease',
    }}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16}}>
        <div>
          <div style={{fontSize:9,color:G.t4,fontFamily:"'Share Tech Mono',monospace",marginBottom:4,letterSpacing:'0.1em'}}>{ticket.ticket_id}</div>
          <Tag label={ticket.severity} color={sev.color} pulse={sev.pulse} size="md"/>
        </div>
        <button onClick={onClose} style={{background:G.bg3,border:`1px solid ${G.b2}`,color:G.t3,borderRadius:5,padding:'6px 8px',cursor:'pointer'}}>
          <X size={14}/>
        </button>
      </div>

      <div style={{fontSize:13,fontWeight:700,color:G.t1,marginBottom:16,lineHeight:1.45,fontFamily:"'Exo 2',sans-serif"}}>{ticket.title}</div>

      <SectionBox title="AI ANALYSIS" accent={G.neon}>
        <p style={{fontSize:11,color:G.t2,marginBottom:10,lineHeight:1.5}}>{ticket.ai.summary}</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:10}}>
          <MiniMetric label="PRIORITY" value={`${ticket.ai.priority_score}/100`} color={sev.color}/>
          <MiniMetric label="CONFIDENCE" value={`${Math.round(ticket.ai.confidence*100)}%`} color={G.neon}/>
          <MiniMetric label="EST. FIX" value={`${ticket.ai.estimated_resolution_min}m`} color={G.yellow}/>
        </div>
        <InfoRow label="Root Cause" value={ticket.ai.root_cause_hypothesis}/>
        <InfoRow label="Team" value={`@${ticket.ai.recommended_team}`} accent={G.neon}/>
        <div style={{marginTop:10}}>
          <div style={{fontSize:9,color:G.t4,fontWeight:700,letterSpacing:'0.1em',marginBottom:7,fontFamily:"'Share Tech Mono',monospace"}}>RECOMMENDED ACTIONS</div>
          {ticket.ai.recommended_actions.map((a,i)=>(
            <div key={i} style={{display:'flex',gap:8,marginBottom:4,fontSize:11,color:G.t2,lineHeight:1.4}}>
              <span style={{color:G.neon,flexShrink:0,fontFamily:"'Share Tech Mono',monospace"}}>{String(i+1).padStart(2,'0')}.</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
        {ticket.ai.similar_fix && (
          <div style={{marginTop:10,padding:'8px 10px',background:`${G.neon}08`,borderRadius:5,border:`1px solid ${G.neon}25`}}>
            <div style={{fontSize:9,color:G.neon,fontWeight:700,marginBottom:4,letterSpacing:'0.08em',fontFamily:"'Share Tech Mono',monospace"}}>📚 KB SIMILAR FIX</div>
            <code style={{fontSize:10,color:G.g300,fontFamily:"'Share Tech Mono',monospace",display:'block',lineHeight:1.5}}>{ticket.ai.similar_fix}</code>
          </div>
        )}
      </SectionBox>

      {ticket.ai.requires_rollback && (
        <SectionBox title="ROLLBACK INFO" accent={G.purple}>
          <InfoRow label="Target" value={ticket.ai.rollback_target||'TBD'} mono accent={G.purple}/>
          <InfoRow label="Confidence" value={`${Math.round(ticket.ai.rollback_confidence*100)}%`}/>
          <InfoRow label="Status" value={
            ticket.workflow_actions.rollback_executed?'✅ Executed':
            ticket.workflow_actions.rollback_requested?'⏳ Awaiting Slack approval':'Not requested'
          } accent={ticket.workflow_actions.rollback_requested?G.yellow:G.t3}/>
        </SectionBox>
      )}

      <SectionBox title="TECHNICAL CONTEXT" accent={G.yellow}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,marginBottom:6}}>
          {[['ENV',ticket.environment],['CLUSTER',ticket.cluster],['NAMESPACE',ticket.namespace],['SOURCE',ticket.source]].map(([l,v])=>(
            <InfoRow key={l} label={l} value={v} mono/>
          ))}
        </div>
        <InfoRow label="SERVICES" value={ticket.affected_services.join(', ')} mono/>
        <InfoRow label="REPORTER" value={`${ticket.reporter.name} · ${ticket.reporter.team}`}/>
        <InfoRow label="SLA" value={new Date(ticket.sla_deadline).toLocaleString()}/>
        {ticket.data_quality.missing_fields.length>0 && (
          <div style={{marginTop:8,padding:'6px 10px',background:`${G.yellow}10`,borderRadius:4,border:`1px solid ${G.yellow}30`,fontSize:10,color:G.yellow,fontFamily:"'Share Tech Mono',monospace"}}>
            ⚠ AUTO-FILLED: {ticket.data_quality.missing_fields.join(', ')}
          </div>
        )}
      </SectionBox>

      <SectionBox title="WORKFLOW ACTIONS" accent={G.neon}>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
          {([
            ['Jira Created',ticket.workflow_actions.jira_created,G.neon],
            ['Slack Notified',ticket.workflow_actions.slack_notified,G.neon],
            ["Rollback Req'd",ticket.workflow_actions.rollback_requested,G.purple],
            ['Rollback Done',ticket.workflow_actions.rollback_executed,G.purple],
          ] as [string,boolean,string][]).map(([label,done,col])=>(
            <span key={label} style={{display:'flex',alignItems:'center',gap:4,fontSize:9,color:done?col:G.t4,padding:'3px 8px',borderRadius:3,background:done?`${col}12`:G.bg3,border:`1px solid ${done?col+'35':G.b1}`,fontFamily:"'Share Tech Mono',monospace"}}>
              {done?<CheckCircle size={9}/>:<X size={9}/>} {label}
            </span>
          ))}
        </div>
        {ticket.jira_url && (
          <a href={ticket.jira_url} target="_blank" rel="noreferrer" style={{fontSize:10,color:G.g400,textDecoration:'none',fontFamily:"'Share Tech Mono',monospace"}}>
            ↗ {ticket.jira_issue_key}
          </a>
        )}
      </SectionBox>

      <SectionBox title="UPDATE STATUS" accent={G.t3}>
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {(['OPEN','INVESTIGATING','MITIGATED','ESCALATED','RESOLVED'] as Status[]).map(s=>{
            const cfg=STA_CFG[s]; const active=ticket.status===s
            return (
              <button key={s} onClick={()=>onStatus(ticket.ticket_id,s)} style={{
                padding:'5px 12px',borderRadius:4,fontSize:9,fontWeight:700,cursor:'pointer',
                letterSpacing:'0.07em',border:`1px solid ${active?cfg.color:G.b2}`,
                background:active?`${cfg.color}18`:G.bg3,color:active?cfg.color:G.t4,
                fontFamily:"'Share Tech Mono',monospace",transition:'all 0.12s',
                boxShadow:active?`0 0 8px ${cfg.color}33`:'none',
              }}>{s}</button>
            )
          })}
        </div>
      </SectionBox>

      <div style={{fontSize:9,color:G.t4,fontFamily:"'Share Tech Mono',monospace",marginTop:6,lineHeight:1.6}}>
        INGESTED {new Date(ticket.ingested_at).toISOString()}<br/>
        KB_MATCHES: {ticket.kb_similar_count} | QUALITY: {ticket.data_quality.completeness_score}%
      </div>
    </div>
  )
}

// ─── Workflow Diagram ─────────────────────────────────────────────────────────
const WorkflowDiagram: React.FC = () => {
  const steps = [
    {label:'GitHub\nCI/CD',      icon:<GitBranch size={13}/>,     col:G.blue  },
    {label:'Manual\nComplaint',  icon:<MessageSquare size={13}/>,  col:G.neon  },
    {label:'Monitoring\nAlert',  icon:<Activity size={13}/>,       col:G.orange},
    {label:'Normalize\n& Clean', icon:<Filter size={13}/>,         col:G.yellow},
    {label:'KB\nLookup',         icon:<BookOpen size={13}/>,       col:G.purple},
    {label:'Claude\nAI',         icon:<Brain size={13}/>,          col:G.neon  },
    {label:'Route by\nSeverity', icon:<TrendingUp size={13}/>,     col:G.yellow},
    {label:'HITL\nApproval',     icon:<Bell size={13}/>,           col:G.orange},
    {label:'K8s\nRollback',      icon:<RotateCcw size={13}/>,      col:G.red   },
    {label:'Create\nJira',       icon:<CheckCircle size={13}/>,    col:G.blue  },
    {label:'Slack\nNotify',      icon:<MessageSquare size={13}/>,  col:G.neon  },
    {label:'Store\nDB+KB',       icon:<Database size={13}/>,       col:G.g400  },
  ]
  return (
    <div style={{background:G.bg2,border:`1px solid ${G.b2}`,borderRadius:8,padding:20}}>
      <div style={{fontSize:9,fontWeight:700,color:G.neon,letterSpacing:'0.12em',marginBottom:16,fontFamily:"'Share Tech Mono',monospace",display:'flex',alignItems:'center',gap:8}}>
        <Terminal size={12}/> N8N ENTERPRISE WORKFLOW ARCHITECTURE
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
        {steps.map((s,i)=>(
          <React.Fragment key={`${s.label}-${i}`}>
            <div style={{background:G.bg3,border:`1px solid ${s.col}30`,borderRadius:7,padding:'9px 12px',display:'flex',flexDirection:'column',alignItems:'center',gap:5,minWidth:68,textAlign:'center',boxShadow:`0 0 12px ${s.col}15`}}>
              <span style={{color:s.col}}>{s.icon}</span>
              <div style={{fontSize:9,fontWeight:700,color:s.col,fontFamily:"'Share Tech Mono',monospace",whiteSpace:'pre',lineHeight:1.3}}>{s.label}</div>
            </div>
            {i<steps.length-1&&<ChevronRight size={10} color={G.b3}/>}
          </React.Fragment>
        ))}
      </div>
      <div style={{height:1,background:`linear-gradient(90deg,transparent,${G.b3},transparent)`,margin:'14px 0'}}/>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
        {[
          [G.blue,  'TRIGGERS',   '3 sources merge into one normalized pipeline: GitHub Webhook, Manual Form, Datadog/PagerDuty Alert'],
          [G.neon,  'AI ENGINE',  'Claude analyzes with KB context: score 1-100, root cause hypothesis, rollback decision, confidence level'],
          [G.orange,'HITL GATE',  'K8s rollbacks require Slack approval (30min timeout). Retry path creates urgent Jira + alerts senior DevOps'],
          [G.purple,'ESCALATION', 'Scheduler polls every 5min. Unresolved after 30min → Slack manager ping, Jira comment, status=ESCALATED'],
        ].map(([col,title,desc])=>(
          <div key={String(title)} style={{background:G.bg3,borderRadius:6,padding:'10px 12px',border:`1px solid ${String(col)}20`}}>
            <div style={{fontSize:9,color:String(col),fontWeight:700,letterSpacing:'0.09em',marginBottom:5,fontFamily:"'Share Tech Mono',monospace"}}>{String(title)}</div>
            <div style={{fontSize:10,color:G.t3,lineHeight:1.5}}>{String(desc)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tickets,   setTickets]   = useState<Ticket[]>(SEED_TICKETS)
  const [selected,  setSelected]  = useState<Ticket|null>(null)
  const [newIds,    setNewIds]    = useState<Set<string>>(new Set())
  const [filterSev, setFilterSev] = useState('ALL')
  const [filterSta, setFilterSta] = useState('ALL')
  const [filterSrc, setFilterSrc] = useState('ALL')
  const [search,    setSearch]    = useState('')
  const [simSrc,    setSimSrc]    = useState<string|null>(null)
  const [tab,       setTab]       = useState<Tab>('incidents')

  const stats = {
    total:    tickets.length,
    open:     tickets.filter(t=>t.status==='OPEN').length,
    critical: tickets.filter(t=>t.severity==='CRITICAL').length,
    resolved: tickets.filter(t=>t.status==='RESOLVED').length,
    sla:      tickets.filter(t=>new Date()>new Date(t.sla_deadline)&&t.status!=='RESOLVED').length,
    rollback: tickets.filter(t=>t.ai.requires_rollback).length,
  }

  const filtered = tickets.filter(t=>{
    if (filterSev!=='ALL'&&t.severity!==filterSev) return false
    if (filterSta!=='ALL'&&t.status!==filterSta)   return false
    if (filterSrc!=='ALL'&&t.source!==filterSrc)   return false
    if (search&&!t.title.toLowerCase().includes(search.toLowerCase())&&!t.ticket_id.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const handleStatus = useCallback((id:string, s:Status)=>{
    setTickets(ts=>ts.map(t=>t.ticket_id===id?{...t,status:s}:t))
    setSelected(prev=>prev?.ticket_id===id?{...prev,status:s}:prev)
  },[])

  const simulate = useCallback(async(src:Source)=>{
    setSimSrc(src)
    await new Promise(r=>setTimeout(r,1800))
    const t = makeMock({source:src})
    setTickets(ts=>[t,...ts])
    setNewIds(ids=>new Set([...ids,t.ticket_id]))
    setTimeout(()=>setNewIds(ids=>{const n=new Set(ids);n.delete(t.ticket_id);return n}),5000)
    setSimSrc(null)
  },[])

  // Chart data
  const sevData  = (['CRITICAL','HIGH','MEDIUM','LOW','INFO'] as Severity[]).map(s=>({name:s,value:tickets.filter(t=>t.severity===s).length,color:SEV_CFG[s].color}))
  const catData  = (['DEPLOYMENT','INFRASTRUCTURE','SECURITY','PERFORMANCE','DATABASE','NETWORK','APPLICATION'] as Category[]).map(c=>({name:c.slice(0,6),value:tickets.filter(t=>t.category===c).length}))
  const srcData  = (['GITHUB','MONITORING','MANUAL'] as Source[]).map(s=>({name:s,value:tickets.filter(t=>t.source===s).length}))
  const trendData = Array.from({length:12},(_,i)=>({hour:`${i*2}h`,tickets:rng(0,9),resolved:rng(0,7)}))

  const ttStyle = {background:G.bg2,border:`1px solid ${G.b2}`,borderRadius:6,fontSize:10,color:G.t2,fontFamily:"'Share Tech Mono',monospace"}

  return (
    <div style={{minHeight:'100vh',background:G.bg0,color:G.t1,fontFamily:"'Exo 2',sans-serif"}}>
      <style>{`
        @keyframes blink     {0%,100%{opacity:1}50%{opacity:0.15}}
        @keyframes slideDown {from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideRight{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)}}
        @keyframes spin      {to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:${G.bg0}}
        ::-webkit-scrollbar-thumb{background:${G.b3};border-radius:2px}
        select,input{background:${G.bg2};color:${G.t2};border:1px solid ${G.b2};border-radius:5px;outline:none;font-family:'Share Tech Mono',monospace}
        select:hover,input:hover{border-color:${G.b3}}
        button{font-family:'Exo 2',sans-serif}
      `}</style>

      {/* Scanline overlay */}
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,background:`repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,100,0.012) 2px,rgba(0,255,100,0.012) 4px)`}}/>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={{background:G.bg1,borderBottom:`1px solid ${G.b2}`,padding:'0 24px',position:'sticky',top:0,zIndex:40,display:'flex',alignItems:'center',height:58,gap:16,boxShadow:`0 1px 20px rgba(0,255,100,0.04)`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{width:34,height:34,background:`linear-gradient(135deg,${G.dim},${G.bg4})`,border:`1px solid ${G.neon}40`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 16px ${G.neon}25`}}>
            <Shield size={16} color={G.neon}/>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:G.neon,letterSpacing:'0.02em',lineHeight:1,textShadow:`0 0 20px ${G.neon}60`}}>DEVOPS·AI</div>
            <div style={{fontSize:8,color:G.t4,letterSpacing:'0.15em',fontFamily:"'Share Tech Mono',monospace"}}>COMMAND CENTER v3.0</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <Radio size={11} color={G.neon}/>
          <span style={{fontSize:8,color:G.neon,fontFamily:"'Share Tech Mono',monospace",letterSpacing:'0.12em',animation:'blink 2s infinite'}}>LIVE</span>
        </div>
        <div style={{flex:1}}/>
        <div style={{display:'flex',gap:0,alignItems:'stretch'}}>
          {[{l:'TOTAL',v:stats.total,c:G.t2},{l:'OPEN',v:stats.open,c:G.orange},{l:'CRITICAL',v:stats.critical,c:G.red},{l:'SLA RISK',v:stats.sla,c:G.purple},{l:'ROLLBACK',v:stats.rollback,c:G.purple},{l:'RESOLVED',v:stats.resolved,c:G.neon}].map(s=>(
            <div key={s.l} style={{textAlign:'center',padding:'0 14px',borderLeft:`1px solid ${G.b2}`}}>
              <div style={{fontSize:20,fontWeight:700,color:s.c,fontFamily:"'Share Tech Mono',monospace",lineHeight:1,textShadow:`0 0 12px ${s.c}55`}}>{s.v}</div>
              <div style={{fontSize:8,color:G.t4,letterSpacing:'0.08em',fontFamily:"'Share Tech Mono',monospace",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
      </header>

      <div style={{padding:'18px 24px',maxWidth:1600,margin:'0 auto',position:'relative',zIndex:1}}>

        {/* ── TRIGGER SIMULATOR ───────────────────────────────────────────────── */}
        <div style={{background:G.bg2,border:`1px solid ${G.b2}`,borderRadius:8,padding:'14px 18px',marginBottom:16}}>
          <div style={{fontSize:9,fontWeight:700,color:G.t4,letterSpacing:'0.12em',marginBottom:12,fontFamily:"'Share Tech Mono',monospace",display:'flex',alignItems:'center',gap:6}}>
            <Cpu size={10} color={G.neon}/> SIMULATE N8N WORKFLOW TRIGGERS
          </div>
          <div style={{display:'flex',gap:8,alignItems:'flex-start',flexWrap:'wrap'}}>
            {([
              {src:'GITHUB' as Source,    label:'GitHub CI/CD Failure', icon:<GitBranch size={13}/>,    col:G.blue,   desc:'workflow_run failure webhook → DEPLOYMENT'},
              {src:'MANUAL' as Source,    label:'Manual Complaint',      icon:<MessageSquare size={13}/>,col:G.neon,   desc:'User form POST → may have missing fields'},
              {src:'MONITORING' as Source,label:'Monitoring Alert',      icon:<Activity size={13}/>,    col:G.orange, desc:'Datadog/PagerDuty webhook → INFRA or PERF'},
            ]).map(({src,label,icon,col,desc})=>(
              <div key={src}>
                <button onClick={()=>simulate(src)} disabled={simSrc!==null} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 16px',background:simSrc===src?`${col}15`:G.bg3,border:`1px solid ${simSrc===src?col:G.b2}`,borderRadius:6,color:simSrc===src?col:G.t3,fontSize:11,fontWeight:700,cursor:simSrc?'not-allowed':'pointer',transition:'all 0.15s',opacity:simSrc&&simSrc!==src?0.35:1,boxShadow:simSrc===src?`0 0 14px ${col}35`:'none'}}>
                  {simSrc===src?<RefreshCw size={13} style={{animation:'spin 0.75s linear infinite'}}/>:icon}
                  {simSrc===src?'PROCESSING...':label}
                  {!simSrc&&<Play size={9} style={{opacity:0.4}}/>}
                </button>
                <div style={{fontSize:9,color:G.t4,marginTop:3,paddingLeft:4,fontFamily:"'Share Tech Mono',monospace"}}>{desc}</div>
              </div>
            ))}
            <div style={{marginLeft:'auto',fontSize:9,color:G.t4,display:'flex',alignItems:'center',gap:5,fontFamily:"'Share Tech Mono',monospace",alignSelf:'center'}}>
              <Brain size={10} color={G.neon}/> n8n → FastAPI → Claude → Jira+Slack
            </div>
          </div>
        </div>

        {/* ── TABS ────────────────────────────────────────────────────────────── */}
        <div style={{display:'flex',gap:2,marginBottom:16,background:G.bg2,border:`1px solid ${G.b2}`,borderRadius:7,padding:3,width:'fit-content'}}>
          {([{k:'incidents' as Tab,l:'INCIDENTS',ic:<Activity size={11}/>},{k:'analytics' as Tab,l:'ANALYTICS',ic:<BarChart3 size={11}/>},{k:'workflow' as Tab,l:'WORKFLOW',ic:<Terminal size={11}/>},{k:'knowledge' as Tab,l:'KNOWLEDGE',ic:<BookOpen size={11}/>}]).map(({k,l,ic})=>(
            <button key={k} onClick={()=>setTab(k)} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',borderRadius:5,border:'none',cursor:'pointer',fontSize:10,fontWeight:700,letterSpacing:'0.07em',background:tab===k?`${G.neon}15`:'transparent',color:tab===k?G.neon:G.t4,boxShadow:tab===k?`0 0 10px ${G.neon}20`:'none',fontFamily:"'Share Tech Mono',monospace",transition:'all 0.15s'}}>
              {ic}{l}
            </button>
          ))}
        </div>

        {/* ── INCIDENTS ────────────────────────────────────────────────────────── */}
        {tab==='incidents'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16}}>
            <div>
              <div style={{display:'flex',gap:7,marginBottom:12,flexWrap:'wrap'}}>
                <div style={{position:'relative',flex:1,minWidth:200}}>
                  <Search size={12} style={{position:'absolute',left:9,top:'50%',transform:'translateY(-50%)',color:G.t4}}/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tickets..." style={{width:'100%',padding:'8px 8px 8px 28px',fontSize:11}}/>
                </div>
                {([{lbl:'Severity',val:filterSev,set:setFilterSev,opts:['ALL','CRITICAL','HIGH','MEDIUM','LOW','INFO']},{lbl:'Status',val:filterSta,set:setFilterSta,opts:['ALL','OPEN','INVESTIGATING','MITIGATED','ESCALATED','RESOLVED']},{lbl:'Source',val:filterSrc,set:setFilterSrc,opts:['ALL','GITHUB','MONITORING','MANUAL']}]).map(({lbl,val,set,opts})=>(
                  <select key={lbl} value={val} onChange={e=>set(e.target.value)} style={{padding:'8px 10px',fontSize:10,cursor:'pointer'}}>
                    {opts.map(o=><option key={o}>{o==='ALL'?`All ${lbl}`:o}</option>)}
                  </select>
                ))}
              </div>
              <div style={{fontSize:9,color:G.t4,marginBottom:8,fontFamily:"'Share Tech Mono',monospace"}}>SHOWING {filtered.length}/{tickets.length} TICKETS</div>
              <div style={{maxHeight:'calc(100vh - 380px)',overflowY:'auto',paddingRight:4}}>
                {filtered.length===0
                  ?<div style={{textAlign:'center',padding:60,color:G.t4,fontFamily:"'Share Tech Mono',monospace"}}><Filter size={28} style={{margin:'0 auto 10px',display:'block',color:G.b3}}/> NO TICKETS MATCH FILTERS</div>
                  :filtered.map(t=><TicketCard key={t.ticket_id} ticket={t} onClick={()=>setSelected(t)} isNew={newIds.has(t.ticket_id)}/>)
                }
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {title:'TRIGGER SOURCES',rows:[['GITHUB',G.blue],['MONITORING',G.orange],['MANUAL',G.neon]] as [Source,string][],type:'source'},
                {title:'SEVERITY MATRIX',rows:[['CRITICAL',G.red],['HIGH',G.orange],['MEDIUM',G.yellow],['LOW',G.blue],['INFO',G.t3]] as [Severity,string][],type:'severity'},
                {title:'STATUS DIST.',rows:[['OPEN',G.red],['INVESTIGATING',G.orange],['MITIGATED',G.yellow],['ESCALATED',G.purple],['RESOLVED',G.neon]] as [Status,string][],type:'status'},
              ].map(({title,rows,type})=>(
                <div key={title} style={{background:G.bg2,border:`1px solid ${G.b2}`,borderRadius:8,padding:14}}>
                  <div style={{fontSize:9,fontWeight:700,color:G.t4,letterSpacing:'0.1em',marginBottom:12,fontFamily:"'Share Tech Mono',monospace"}}>{title}</div>
                  {(rows as [string,string][]).map(([key,col])=>(
                    <BarRow key={key} label={key}
                      count={type==='source'?tickets.filter(t=>t.source===key).length:type==='severity'?tickets.filter(t=>t.severity===key).length:tickets.filter(t=>t.status===key).length}
                      total={tickets.length} color={col}/>
                  ))}
                </div>
              ))}
              <div style={{background:G.bg2,border:`1px solid ${G.b2}`,borderRadius:8,padding:14}}>
                <div style={{fontSize:9,fontWeight:700,color:G.t4,letterSpacing:'0.1em',marginBottom:12,fontFamily:"'Share Tech Mono',monospace"}}>AUTOMATION STATS</div>
                {([
                  ['JIRA CREATED',tickets.filter(t=>t.workflow_actions.jira_created).length,G.neon],
                  ['SLACK NOTIFIED',tickets.filter(t=>t.workflow_actions.slack_notified).length,G.neon],
                  ['ROLLBACK REQ',tickets.filter(t=>t.workflow_actions.rollback_requested).length,G.purple],
                  ['SLA BREACH',tickets.filter(t=>new Date()>new Date(t.sla_deadline)&&t.status!=='RESOLVED').length,G.red],
                  ['MISSING DATA',tickets.filter(t=>t.data_quality.missing_fields.length>0).length,G.yellow],
                ] as [string,number,string][]).map(([label,value,col])=>(
                  <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                    <span style={{fontSize:9,color:G.t4,fontFamily:"'Share Tech Mono',monospace"}}>{label}</span>
                    <span style={{fontSize:13,fontWeight:700,color:col,fontFamily:"'Share Tech Mono',monospace",textShadow:`0 0 8px ${col}55`}}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ────────────────────────────────────────────────────────── */}
        {tab==='analytics'&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            {[
              {title:'12H INCIDENT TREND',chart:(
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={G.neon} stopOpacity={0.25}/><stop offset="95%" stopColor={G.neon} stopOpacity={0}/></linearGradient>
                      <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={G.blue} stopOpacity={0.2}/><stop offset="95%" stopColor={G.blue} stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={G.b2}/>
                    <XAxis dataKey="hour" tick={{fontSize:9,fill:G.t4,fontFamily:"'Share Tech Mono',monospace"}}/>
                    <YAxis tick={{fontSize:9,fill:G.t4,fontFamily:"'Share Tech Mono',monospace"}}/>
                    <Tooltip contentStyle={ttStyle}/>
                    <Area type="monotone" dataKey="tickets" stroke={G.neon} fill="url(#ga)" strokeWidth={2} name="Tickets"/>
                    <Area type="monotone" dataKey="resolved" stroke={G.blue} fill="url(#gb)" strokeWidth={2} name="Resolved"/>
                  </AreaChart>
                </ResponsiveContainer>
              )},
              {title:'BY CATEGORY',chart:(
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={catData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={G.b2}/>
                    <XAxis dataKey="name" tick={{fontSize:9,fill:G.t4,fontFamily:"'Share Tech Mono',monospace"}}/>
                    <YAxis tick={{fontSize:9,fill:G.t4,fontFamily:"'Share Tech Mono',monospace"}}/>
                    <Tooltip contentStyle={ttStyle}/>
                    <Bar dataKey="value" radius={[3,3,0,0]}>
                      {catData.map((_,i)=><Cell key={i} fill={[G.neon,G.blue,G.red,G.yellow,G.purple,G.orange,G.g400][i%7]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )},
              {title:'SEVERITY SPLIT',chart:(
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={sevData.filter(d=>d.value>0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={4}>
                      {sevData.filter(d=>d.value>0).map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={ttStyle}/>
                    <Legend iconSize={8} wrapperStyle={{fontSize:9,fontFamily:"'Share Tech Mono',monospace"}}/>
                  </PieChart>
                </ResponsiveContainer>
              )},
              {title:'TRIGGER SOURCES',chart:(
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={srcData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={G.b2}/>
                    <XAxis type="number" tick={{fontSize:9,fill:G.t4,fontFamily:"'Share Tech Mono',monospace"}}/>
                    <YAxis dataKey="name" type="category" width={80} tick={{fontSize:9,fill:G.t4,fontFamily:"'Share Tech Mono',monospace"}}/>
                    <Tooltip contentStyle={ttStyle}/>
                    <Bar dataKey="value" fill={G.neon} radius={[0,3,3,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )},
            ].map(({title,chart})=>(
              <div key={title} style={{background:G.bg2,border:`1px solid ${G.b2}`,borderRadius:8,padding:18}}>
                <div style={{fontSize:9,fontWeight:700,color:G.t4,letterSpacing:'0.1em',marginBottom:14,fontFamily:"'Share Tech Mono',monospace",display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:8,height:1,background:G.neon,display:'inline-block'}}/>{title}
                </div>
                {chart}
              </div>
            ))}
          </div>
        )}

        {tab==='workflow'&&<WorkflowDiagram/>}

        {tab==='knowledge'&&(
          <div>
            <div style={{fontSize:9,color:G.t4,marginBottom:14,fontFamily:"'Share Tech Mono',monospace"}}>
              {tickets.filter(t=>t.status==='RESOLVED').length} RESOLVED INCIDENTS — AI USES THESE FOR ROOT CAUSE COMPARISON
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(310px,1fr))',gap:12}}>
              {tickets.filter(t=>t.status==='RESOLVED'||t.kb_similar_count>0).slice(0,9).map(t=>(
                <div key={t.ticket_id} style={{background:G.bg2,border:`1px solid ${G.b2}`,borderRadius:8,padding:16,borderLeft:`2px solid ${G.neon}40`}}>
                  <div style={{display:'flex',gap:5,marginBottom:8,flexWrap:'wrap'}}>
                    <Tag label={t.category} color={G.t3}/>
                    <Tag label={t.severity} color={SEV_CFG[t.severity].color}/>
                    {t.status==='RESOLVED'&&<Tag label="RESOLVED" color={G.neon}/>}
                  </div>
                  <div style={{fontSize:12,fontWeight:600,color:G.t1,marginBottom:7,lineHeight:1.4,fontFamily:"'Exo 2',sans-serif"}}>{t.title}</div>
                  <div style={{fontSize:10,color:G.t3,marginBottom:8,lineHeight:1.5}}>{t.ai.root_cause_hypothesis.slice(0,120)}...</div>
                  {t.ai.similar_fix&&(
                    <div style={{padding:'6px 8px',background:`${G.neon}08`,borderRadius:4,border:`1px solid ${G.neon}20`,marginBottom:8}}>
                      <div style={{fontSize:8,color:G.neon,marginBottom:3,fontFamily:"'Share Tech Mono',monospace"}}>APPLIED FIX</div>
                      <code style={{fontSize:10,color:G.g300,fontFamily:"'Share Tech Mono',monospace",display:'block',lineHeight:1.4}}>{t.ai.similar_fix}</code>
                    </div>
                  )}
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {t.ai.tags.map(tag=><span key={tag} style={{fontSize:8,padding:'1px 5px',background:G.bg3,color:G.t4,borderRadius:3,border:`1px solid ${G.b2}`,fontFamily:"'Share Tech Mono',monospace"}}>{tag}</span>)}
                  </div>
                  <div style={{fontSize:8,color:G.t4,marginTop:8,fontFamily:"'Share Tech Mono',monospace"}}>
                    CONFIDENCE: {Math.round(t.ai.confidence*100)}% | KB_MATCHES: {t.kb_similar_count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected&&<DetailPanel ticket={selected} onClose={()=>setSelected(null)} onStatus={handleStatus}/>}
    </div>
  )
}
