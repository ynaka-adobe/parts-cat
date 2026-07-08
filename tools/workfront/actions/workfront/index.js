const REDIRECT_URI = 'https://main--parts-cat--ynaka-adobe.aem.live/tools/workfront/workfront.html';

async function tokenRequest(domain, body) {
  const resp = await fetch(`https://${domain}/integrations/oauth2/api/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp.json();
}

function wfRequest(method, path, domain, token, body) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://${domain}/attask/api/v18.0${path}${sep}sessionID=${encodeURIComponent(token)}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts).then((r) => r.json());
}

async function main(params) {
  if (params.__ow_method === 'OPTIONS') {
    return { statusCode: 204 };
  }

  const clientId = params.WF_CLIENT_ID;
  const clientSecret = params.WF_CLIENT_SECRET;
  const domain = params.WF_DOMAIN;

  if (!clientId || !clientSecret || !domain) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing WF_CLIENT_ID, WF_CLIENT_SECRET, or WF_DOMAIN' }) };
  }

  const resource = params.resource || 'projects';

  try {
    if (resource === 'exchange_code') {
      const code = params.code;
      if (!code) return { statusCode: 400, body: JSON.stringify({ error: 'Missing code' }) };
      const tokens = await tokenRequest(domain, {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: REDIRECT_URI,
      });
      return { statusCode: 200, body: JSON.stringify(tokens) };
    }

    if (resource === 'refresh_token') {
      const refreshToken = params.refresh_token;
      if (!refreshToken) return { statusCode: 400, body: JSON.stringify({ error: 'Missing refresh_token' }) };
      const tokens = await tokenRequest(domain, {
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      });
      return { statusCode: 200, body: JSON.stringify(tokens) };
    }

    const token = params.wf_token;
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

    const projectId = params.projectId || null;
    const docVersionId = params.docVersionId || null;
    const limit = Number(params.limit) || 100;
    let data;

    if (resource === 'projects') {
      let filterQs = '';
      if (params.filter === 'owner') {
        filterQs = '&ownerID=$$USER.ID';
      } else {
        // "I'm On" — only projects where the current user is a team member
        filterQs = '&projectUsers:userID=$$USER.ID';
      }
      data = await wfRequest('GET',
        `/PROJ/search?fields=ID,name,status,percentComplete,plannedCompletionDate,owner:name&$$LIMIT=${limit}&$$FIRST=0${filterQs}`,
        domain, token);
    } else if (resource === 'documents' && projectId) {
      data = await wfRequest('GET',
        `/DOCU/search?projectID=${projectId}&fields=ID,name,docObjCode,currentVersionID,description,owner:name,lastModDate&$$LIMIT=${limit}`,
        domain, token);
    } else if (resource === 'approval' && docVersionId) {
      data = await wfRequest('GET',
        `/DOCAPVRS/search?documentVersionID=${docVersionId}&fields=ID,status,approverDecision,reviewer:name,reviewer:emailAddr,reviewDate&$$LIMIT=50`,
        domain, token);
    } else if (resource === 'tasks' && projectId) {
      data = await wfRequest('GET',
        `/TASK/search?projectID=${projectId}&fields=ID,taskNumber,name,status,percentComplete,assignedTo:name,plannedCompletionDate&$$FIRST=0&$$LIMIT=${limit}`,
        domain, token);
    } else if (resource === 'current_user') {
      data = await wfRequest('GET', `/USER/search?ID=$$USER.ID&fields=ID,name,emailAddr&$$LIMIT=1`, domain, token);
    } else if (resource === 'create_task') {
      if (!params.name) return { statusCode: 400, body: JSON.stringify({ error: 'Task name is required' }) };
      if (!projectId) return { statusCode: 400, body: JSON.stringify({ error: 'projectId is required' }) };
      const taskBody = { name: params.name, projectID: projectId };
      if (params.description) taskBody.description = params.description;
      if (params.plannedCompletionDate) taskBody.plannedCompletionDate = params.plannedCompletionDate;
      if (params.duration) { taskBody.duration = Number(params.duration); taskBody.durationUnit = 'D'; }
      if (params.assignedToID) taskBody.assignedToID = params.assignedToID;
      data = await wfRequest('POST', `/TASK?fields=ID,name,taskNumber,status`, domain, token, taskBody);
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: `Unknown resource "${resource}"` }) };
    }

    // Surface Workfront-level errors clearly
    if (data && data.error) {
      const msg = typeof data.error === 'string' ? data.error
        : data.error.message || JSON.stringify(data.error);
      return { statusCode: 400, body: JSON.stringify({ error: msg, raw: data.error }) };
    }

    return { statusCode: 200, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}

exports.main = main;
