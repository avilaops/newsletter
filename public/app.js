const API_BASE = "/api";

const STATUS = {
  draft: { label: "Rascunho", group: "draft" },
  rejected: { label: "Rejeitada", group: "rejected" },
  in_review: { label: "Em revisão", group: "review" },
  pending_review: { label: "Em revisão", group: "review" },
  review: { label: "Em revisão", group: "review" },
  submitted: { label: "Em revisão", group: "review" },
  under_review: { label: "Em revisão", group: "review" },
  pending_approval: { label: "Em revisão", group: "review" },
  awaiting_approval: { label: "Em revisão", group: "review" },
  approved: { label: "Aprovada", group: "approved" },
};

const DELIVERY_STATUS = {
  queued: { label: "Na fila", group: "queued" },
  dispatching: { label: "Preparando envio", group: "queued" },
  dispatched: { label: "Despachada", group: "sent" },
  sent: { label: "Enviada", group: "sent" },
  failed: { label: "Falha na entrega", group: "failed" },
  cancelled: { label: "Entrega cancelada", group: "failed" },
};

const ACTIONS = {
  submit: {
    title: "Submeter para revisão",
    eyebrow: "Avançar campanha",
    description: "A campanha ficará disponível para decisão editorial. Confirme que o conteúdo e as listas estão prontos para revisão.",
    button: "Submeter revisão",
    endpoint: "submit",
    success: "Campanha submetida para revisão.",
  },
  approve: {
    title: "Aprovar campanha",
    eyebrow: "Decisão editorial",
    description: "A aprovação fica vinculada ao conteúdo atual. Informe quem realizou a revisão para liberar o enfileiramento.",
    button: "Aprovar campanha",
    endpoint: "approve",
    success: "Campanha aprovada.",
  },
  reject: {
    title: "Rejeitar campanha",
    eyebrow: "Solicitar correções",
    description: "A campanha voltará para correção. Registre um motivo objetivo para orientar a próxima revisão.",
    button: "Rejeitar campanha",
    endpoint: "reject",
    requiresReason: true,
    danger: true,
    success: "Campanha rejeitada e devolvida para correção.",
  },
  queue: {
    title: "Enfileirar campanha",
    eyebrow: "Preparar entrega",
    description: "A campanha aprovada será colocada na fila. A entrega continuará sujeita à trava operacional indicada no painel.",
    button: "Enfileirar",
    endpoint: "queue",
    success: "Campanha adicionada à fila.",
  },
};

const state = {
  campaigns: [],
  sources: [],
  articles: [],
  audiences: [],
  filter: "all",
  currentAction: null,
  currentCampaignId: null,
  adminId: sessionStorage.getItem("avila.adminId") || "",
  token: sessionStorage.getItem("avila.adminToken") || "",
};

const elements = {
  healthStatus: document.querySelector("#health-status"),
  deliveryBanner: document.querySelector("#delivery-banner"),
  deliveryTitle: document.querySelector("#delivery-title"),
  deliveryCopy: document.querySelector("#delivery-copy"),
  retryHealth: document.querySelector("#retry-health"),
  loading: document.querySelector("#campaign-loading"),
  error: document.querySelector("#campaign-error"),
  errorCopy: document.querySelector("#campaign-error-copy"),
  empty: document.querySelector("#campaign-empty"),
  emptyCopy: document.querySelector("#empty-copy"),
  list: document.querySelector("#campaign-list"),
  filter: document.querySelector("#status-filter"),
  createDialog: document.querySelector("#create-dialog"),
  createForm: document.querySelector("#create-form"),
  createSubmit: document.querySelector("#create-submit"),
  createError: document.querySelector("#create-error"),
  actionDialog: document.querySelector("#action-dialog"),
  actionForm: document.querySelector("#action-form"),
  actionEyebrow: document.querySelector("#action-eyebrow"),
  actionTitle: document.querySelector("#action-title"),
  actionDescription: document.querySelector("#action-description"),
  actionSubmit: document.querySelector("#action-submit"),
  actionError: document.querySelector("#action-error"),
  reasonField: document.querySelector("#reason-field"),
  reason: document.querySelector("#action-reason"),
  toastRegion: document.querySelector("#toast-region"),
  metricTotal: document.querySelector("#metric-total"),
  metricReview: document.querySelector("#metric-review"),
  metricApproved: document.querySelector("#metric-approved"),
  metricQueued: document.querySelector("#metric-queued"),
  sessionForm: document.querySelector("#session-form"),
  sessionAdmin: document.querySelector("#session-admin"),
  sessionToken: document.querySelector("#session-token"),
  sessionStatus: document.querySelector("#session-status"),
  openCreate: document.querySelector("#open-create"),
  sourceList: document.querySelector("#source-list"),
  articleList: document.querySelector("#article-list"),
  articleCount: document.querySelector("#article-count"),
  audienceList: document.querySelector("#audience-list"),
  sourceDialog: document.querySelector("#source-dialog"),
  sourceForm: document.querySelector("#source-form"),
  sourceError: document.querySelector("#source-error"),
  audienceDialog: document.querySelector("#audience-dialog"),
  audienceForm: document.querySelector("#audience-form"),
  audienceError: document.querySelector("#audience-error"),
  campaignAudiences: document.querySelector("#campaign-audiences"),
  campaignArticles: document.querySelector("#campaign-articles"),
  previewDialog: document.querySelector("#preview-dialog"),
  previewFrame: document.querySelector("#preview-frame"),
  previewTitle: document.querySelector("#preview-title"),
  previewSubject: document.querySelector("#preview-subject"),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusInfo(status) {
  const key = String(status || "draft").trim().toLowerCase();
  return STATUS[key] || { label: key.replaceAll("_", " ") || "Desconhecido", group: "draft" };
}

function editorialInfo(campaign) {
  return statusInfo(campaign.editorialStatus ?? campaign.status);
}

function deliveryInfo(campaign) {
  const key = String(campaign.deliveryStatus || "").trim().toLowerCase();
  return DELIVERY_STATUS[key] || null;
}

async function api(path, options = {}) {
  const isHealth = path === "/health";
  const isWrite = options.method && options.method !== "GET";
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(!isHealth && state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(isWrite && state.adminId ? { "X-Admin-Id": state.adminId } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const apiError = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
    const message = response.status === 401
      ? "Sessão inválida. Confira o token administrativo."
      : apiError || payload?.message || `A API respondeu com status ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

function setHidden(element, hidden) {
  element.classList.toggle("is-hidden", hidden);
}

function setPending(button, pending) {
  button.disabled = pending;
  button.classList.toggle("is-pending", pending);
  button.setAttribute("aria-busy", String(pending));
}

function notify(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast${type === "error" ? " toast--error" : ""}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.textContent = message;
  elements.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 4800);
}

function errorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function loadHealth() {
  elements.healthStatus.className = "health-pill is-loading";
  elements.healthStatus.lastElementChild.textContent = "Verificando entrega…";
  elements.deliveryBanner.className = "safety-banner is-loading";
  elements.deliveryTitle.textContent = "Verificando trava de envio";
  elements.deliveryCopy.textContent = "Aguarde enquanto confirmamos o estado operacional do serviço.";
  setHidden(elements.retryHealth, true);

  try {
    const health = await api("/health");
    const enabled = health?.deliveryEnabled === true;
    elements.healthStatus.className = `health-pill ${enabled ? "is-enabled" : "is-safe"}`;
    elements.healthStatus.lastElementChild.textContent = enabled ? "Entrega habilitada" : "Envio bloqueado";
    elements.deliveryBanner.className = `safety-banner ${enabled ? "is-enabled" : "is-safe"}`;
    elements.deliveryTitle.textContent = enabled ? "Entrega operacional habilitada" : "Envio bloqueado por segurança";
    elements.deliveryCopy.textContent = enabled
      ? "Campanhas aprovadas podem avançar para a fila. Confirme audiência e conteúdo antes de enfileirar."
      : "Criar, revisar e aprovar continua disponível. Nenhum e-mail será entregue enquanto a trava estiver ativa.";
  } catch (error) {
    elements.healthStatus.className = "health-pill is-error";
    elements.healthStatus.lastElementChild.textContent = "Estado desconhecido";
    elements.deliveryBanner.className = "safety-banner is-error";
    elements.deliveryTitle.textContent = "Não foi possível confirmar a trava";
    elements.deliveryCopy.textContent = `${errorMessage(error, "Falha ao consultar o serviço.")} Considere a entrega bloqueada até nova verificação.`;
    setHidden(elements.retryHealth, false);
  }
}

function renderSources() {
  elements.sourceList.replaceChildren();
  if (!state.sources.length) {
    elements.sourceList.innerHTML = '<p class="muted-copy">Nenhuma fonte cadastrada.</p>';
    return;
  }
  for (const source of state.sources) {
    const item = document.createElement("div");
    item.className = "compact-item";
    item.innerHTML = `<span class="source-kind">${escapeHtml(source.type).toUpperCase()}</span><div><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.category)} · ${source.active ? "ativa" : "pausada"}</small></div><span class="item-state ${source.active ? "is-on" : ""}">${source.active ? "Coletando" : "Pausada"}</span>`;
    elements.sourceList.append(item);
  }
}

function renderArticles() {
  elements.articleList.replaceChildren();
  elements.articleCount.textContent = `${state.articles.length} ${state.articles.length === 1 ? "item" : "itens"}`;
  if (!state.articles.length) {
    elements.articleList.innerHTML = '<p class="muted-copy">Aguardando a primeira coleta do n8n.</p>';
    return;
  }
  for (const article of state.articles.slice(0, 8)) {
    const item = document.createElement("div");
    item.className = "compact-item article-item";
    item.innerHTML = `<div><strong>${escapeHtml(article.title)}</strong><small>${escapeHtml(article.category)} · ${formatDate(article.publishedAt)}</small></div><span class="item-state">Disponível</span>`;
    elements.articleList.append(item);
  }
}

function renderAudiences() {
  elements.audienceList.replaceChildren();
  if (!state.audiences.length) {
    elements.audienceList.innerHTML = '<p class="muted-copy">Nenhuma audiência configurada.</p>';
    return;
  }
  for (const audience of state.audiences) {
    const item = document.createElement("div");
    item.className = "compact-item";
    item.innerHTML = `<div><strong>${escapeHtml(audience.name)}</strong><small>${escapeHtml(audience.description || "Sem descrição")}</small></div><span class="count-pill">${Number(audience.recipientCount).toLocaleString("pt-BR")} contatos</span>`;
    elements.audienceList.append(item);
  }
}

async function loadWorkspace() {
  if (!state.token) return;
  try {
    const [sources, articles, audiences] = await Promise.all([
      api("/sources"), api("/articles"), api("/audiences"),
    ]);
    state.sources = sources.data ?? [];
    state.articles = articles.data ?? [];
    state.audiences = audiences.data ?? [];
    renderSources();
    renderArticles();
    renderAudiences();
  } catch (error) {
    notify(errorMessage(error, "Não foi possível carregar a configuração."), "error");
  }
}

async function loadCampaigns() {
  setHidden(elements.loading, false);
  setHidden(elements.error, true);
  setHidden(elements.empty, true);
  setHidden(elements.list, true);

  if (!state.token) {
    setHidden(elements.loading, true);
    setHidden(elements.error, false);
    elements.errorCopy.textContent = "Informe o administrador e o token da plataforma para carregar as campanhas.";
    updateMetrics([]);
    return;
  }

  try {
    const payload = await api("/campaigns");
    state.campaigns = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    renderCampaigns();
  } catch (error) {
    setHidden(elements.loading, true);
    setHidden(elements.error, false);
    elements.errorCopy.textContent = errorMessage(error, "Confira a conexão com a API.");
    updateMetrics([]);
  }
}

function updateMetrics(campaigns) {
  const countEditorial = (group) => campaigns.filter((campaign) => editorialInfo(campaign).group === group).length;
  const countDelivery = (group) => campaigns.filter((campaign) => deliveryInfo(campaign)?.group === group).length;
  elements.metricTotal.textContent = String(campaigns.length);
  elements.metricReview.textContent = String(countEditorial("review"));
  elements.metricApproved.textContent = String(countEditorial("approved"));
  elements.metricQueued.textContent = String(countDelivery("queued"));
}

function formatDate(value) {
  if (!value) return "sem atualização registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function shortHash(value) {
  if (!value) return null;
  const hash = String(value);
  return hash.length > 12 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

function createSvg(path) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute("d", path);
  svg.append(shape);
  return svg;
}

function appendMeta(list, iconPath, text) {
  const item = document.createElement("li");
  item.append(createSvg(iconPath), document.createTextNode(text));
  list.append(item);
}

function actionButton(label, action, variant = "secondary") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `button button--${variant}`;
  button.dataset.action = action;
  button.textContent = label;
  return button;
}

function campaignCard(campaign) {
  const info = editorialInfo(campaign);
  const delivery = deliveryInfo(campaign);
  const article = document.createElement("article");
  article.className = "campaign-card";
  article.dataset.campaignId = String(campaign.id);

  const header = document.createElement("div");
  header.className = "campaign-card__header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "campaign-title-wrap";
  const titleLine = document.createElement("div");
  titleLine.className = "campaign-title-line";
  const title = document.createElement("h3");
  title.textContent = campaign.name || "Campanha sem nome";
  const badge = document.createElement("span");
  badge.className = `status-badge status-badge--${info.group}`;
  badge.textContent = info.label;
  titleLine.append(title, badge);
  if (delivery) {
    const deliveryBadge = document.createElement("span");
    deliveryBadge.className = `status-badge status-badge--${delivery.group}`;
    deliveryBadge.textContent = delivery.label;
    titleLine.append(deliveryBadge);
  }

  const subject = document.createElement("p");
  subject.className = "campaign-subject";
  subject.textContent = campaign.subject ? `Assunto: ${campaign.subject}` : "Assunto ainda não informado";
  titleWrap.append(titleLine, subject);

  const meta = document.createElement("ul");
  meta.className = "campaign-meta";
  appendMeta(meta, "M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm1 5a1 1 0 1 0-2 0v5c0 .38.21.72.55.9l3 1.75a1 1 0 1 0 1-1.73L13 11.42V7Z", `Atualizada em ${formatDate(campaign.updatedAt)}`);
  const audiences = Array.isArray(campaign.audienceListIds) ? campaign.audienceListIds : [];
  appendMeta(meta, "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6.5-2a3.5 3.5 0 1 0 0-7 1 1 0 1 0 0 2 1.5 1.5 0 1 1-1.45 1.88 1 1 0 0 0-1.94.49A3.5 3.5 0 0 0 15.5 9ZM9 13c-4 0-7 2.04-7 4.75V20a1 1 0 1 0 2 0v-2.25C4 16.47 5.84 15 9 15s5 1.47 5 2.75V20a1 1 0 1 0 2 0v-2.25C16 15.04 13 13 9 13Zm7.76.15a1 1 0 0 0-.52 1.93c2.41.65 3.76 1.87 3.76 2.92v2a1 1 0 1 0 2 0v-2c0-2.3-2.3-4.05-5.24-4.85Z", audiences.length ? `${audiences.length} ${audiences.length === 1 ? "lista" : "listas"} de audiência` : "Sem audiência definida");
  const hash = shortHash(campaign.contentHash);
  if (hash) appendMeta(meta, "M10.6 2.2a1 1 0 0 1 1.2.8L11.42 5h3.16l.44-2.2a1 1 0 1 1 1.96.4L16.62 5H19a1 1 0 1 1 0 2h-2.78l-1 5H18a1 1 0 1 1 0 2h-3.18l-.62 3.1a1 1 0 0 1-1.96-.4l.54-2.7H9.62l-.64 3.2a1 1 0 1 1-1.96-.4l.56-2.8H5a1 1 0 1 1 0-2h2.98l1-5H6a1 1 0 0 1 0-2h3.38l.42-2.1a1 1 0 0 1 .8-.7ZM10.02 12h3.16l1-5h-3.16l-1 5Z", `Hash ${hash}`);
  titleWrap.append(meta);

  if (info.group === "approved" && campaign.approvedHash) {
    const sameHash = campaign.contentHash === campaign.approvedHash;
    const hashNotice = document.createElement("span");
    hashNotice.className = sameHash ? "hash-match" : "hash-warning";
    hashNotice.textContent = sameHash ? "✓ Conteúdo atual corresponde à aprovação" : "⚠ Conteúdo alterado após a aprovação";
    titleWrap.append(hashNotice);
  }

  const actions = document.createElement("div");
  actions.className = "campaign-actions";
  actions.append(actionButton("Pré-visualizar", "preview", "secondary"));
  if (info.group === "draft") {
    actions.append(actionButton("Submeter revisão", "submit", "primary"));
  } else if (info.group === "review") {
    actions.append(actionButton("Rejeitar", "reject", "danger"), actionButton("Aprovar", "approve", "primary"));
  } else if (info.group === "approved" && !delivery) {
    const queue = actionButton("Enfileirar", "queue", "primary");
    if (campaign.approvedHash && campaign.contentHash !== campaign.approvedHash) {
      queue.disabled = true;
      queue.title = "O conteúdo mudou depois da aprovação.";
    }
    actions.append(queue);
  }

  header.append(titleWrap, actions);
  article.append(header);
  return article;
}

function renderCampaigns() {
  setHidden(elements.loading, true);
  setHidden(elements.error, true);
  elements.list.replaceChildren();
  updateMetrics(state.campaigns);

  const filtered = state.filter === "all"
    ? state.campaigns
    : state.campaigns.filter((campaign) => {
      const editorialGroup = editorialInfo(campaign).group;
      const deliveryGroup = deliveryInfo(campaign)?.group;
      return editorialGroup === state.filter || deliveryGroup === state.filter;
    });

  if (!filtered.length) {
    elements.emptyCopy.textContent = state.campaigns.length
      ? "Nenhuma campanha corresponde ao filtro selecionado."
      : "Crie um rascunho para iniciar o fluxo editorial.";
    setHidden(document.querySelector("#empty-create"), state.campaigns.length > 0);
    setHidden(elements.empty, false);
    setHidden(elements.list, true);
    return;
  }

  filtered.forEach((campaign) => elements.list.append(campaignCard(campaign)));
  setHidden(elements.empty, true);
  setHidden(elements.list, false);
}

function openCreate() {
  elements.createForm.reset();
  setHidden(elements.createError, true);
  elements.campaignAudiences.replaceChildren();
  elements.campaignArticles.replaceChildren();
  for (const audience of state.audiences.filter((item) => item.active)) {
    const label = document.createElement("label");
    label.className = "choice-card";
    label.innerHTML = `<input type="checkbox" name="audienceListIds" value="${audience.id}"><span><strong>${escapeHtml(audience.name)}</strong><small>${Number(audience.recipientCount).toLocaleString("pt-BR")} contatos</small></span>`;
    elements.campaignAudiences.append(label);
  }
  if (!state.audiences.length) elements.campaignAudiences.innerHTML = '<p class="muted-copy">Cadastre uma audiência antes de criar a campanha.</p>';
  for (const article of state.articles) {
    const label = document.createElement("label");
    label.className = "article-choice";
    label.innerHTML = `<input type="checkbox" name="articleIds" value="${article.id}"><span><strong>${escapeHtml(article.title)}</strong><small>${escapeHtml(article.summary || article.category)}</small></span>`;
    elements.campaignArticles.append(label);
  }
  if (!state.articles.length) elements.campaignArticles.innerHTML = '<p class="muted-copy">Ainda não há notícias coletadas.</p>';
  elements.createDialog.showModal();
  window.setTimeout(() => document.querySelector("#campaign-name").focus(), 0);
}

async function submitCreate(event) {
  event.preventDefault();
  setHidden(elements.createError, true);
  if (!elements.createForm.reportValidity()) return;

  const data = new FormData(elements.createForm);
  const audienceListIds = data.getAll("audienceListIds").map(Number);
  const articleIds = data.getAll("articleIds").map(String);

  if (!audienceListIds.length || audienceListIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    elements.createError.textContent = "Selecione ao menos uma audiência.";
    setHidden(elements.createError, false);
    return;
  }
  if (!articleIds.length) {
    elements.createError.textContent = "Selecione ao menos uma notícia para a edição.";
    setHidden(elements.createError, false);
    return;
  }

  const selectedArticles = articleIds.map((id) => state.articles.find((article) => article.id === id)).filter(Boolean);
  const intro = String(data.get("intro") || "").trim();
  const articleMarkup = selectedArticles.map((article) => `<article style="margin:0 0 28px"><h2 style="margin:0 0 8px;font-size:22px">${escapeHtml(article.title)}</h2><p style="color:#475467;line-height:1.6">${escapeHtml(article.summary || article.body)}</p>${article.sourceUrl ? `<p><a href="${escapeHtml(article.sourceUrl)}">Ler na fonte</a></p>` : ""}</article>`).join("");
  const htmlContent = `<!doctype html><html><body style="margin:0;background:#f3f6f5;font-family:Arial,sans-serif;color:#17202a"><main style="max-width:640px;margin:auto;background:#fff;padding:40px">${intro ? `<p style="font-size:17px;line-height:1.7">${escapeHtml(intro)}</p>` : ""}${articleMarkup}</main></body></html>`;

  const payload = {
    name: String(data.get("name") || "").trim(),
    subject: String(data.get("subject") || "").trim(),
    previewText: String(data.get("previewText") || "").trim(),
    htmlContent,
    audienceListIds,
  };

  setPending(elements.createSubmit, true);
  try {
    await api("/campaigns", { method: "POST", body: JSON.stringify(payload) });
    elements.createDialog.close();
    notify("Rascunho criado com sucesso.");
    await loadCampaigns();
  } catch (error) {
    elements.createError.textContent = errorMessage(error, "Não foi possível criar a campanha.");
    setHidden(elements.createError, false);
  } finally {
    setPending(elements.createSubmit, false);
  }
}

function openAction(action, campaignId) {
  const config = ACTIONS[action];
  if (!config) return;
  state.currentAction = action;
  state.currentCampaignId = campaignId;
  elements.actionForm.reset();
  setHidden(elements.actionError, true);
  elements.actionEyebrow.textContent = config.eyebrow;
  elements.actionTitle.textContent = config.title;
  elements.actionDescription.textContent = config.description;
  elements.actionSubmit.textContent = config.button;
  elements.actionSubmit.className = `button button--${config.danger ? "danger" : "primary"}`;
  elements.reason.required = Boolean(config.requiresReason);
  setHidden(elements.reasonField, !config.requiresReason);
  elements.actionDialog.showModal();
  if (config.requiresReason) window.setTimeout(() => elements.reason.focus(), 0);
}

async function submitAction(event) {
  event.preventDefault();
  const config = ACTIONS[state.currentAction];
  if (!config || !state.currentCampaignId) return;
  setHidden(elements.actionError, true);
  if (!elements.actionForm.reportValidity()) return;

  const payload = {};
  if (config.requiresReason) payload.reason = elements.reason.value.trim();

  setPending(elements.actionSubmit, true);
  try {
    const id = encodeURIComponent(String(state.currentCampaignId));
    await api(`/campaigns/${id}/${config.endpoint}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    elements.actionDialog.close();
    notify(config.success);
    await Promise.all([loadCampaigns(), loadHealth()]);
  } catch (error) {
    elements.actionError.textContent = errorMessage(error, "Não foi possível concluir a ação.");
    setHidden(elements.actionError, false);
  } finally {
    setPending(elements.actionSubmit, false);
  }
}

elements.filter.addEventListener("change", (event) => {
  state.filter = event.target.value;
  renderCampaigns();
});
elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  const card = button?.closest("[data-campaign-id]");
  if (!button || !card) return;
  if (button.dataset.action === "preview") {
    const campaign = state.campaigns.find((item) => String(item.id) === card.dataset.campaignId);
    if (!campaign) return;
    elements.previewTitle.textContent = campaign.name;
    elements.previewSubject.textContent = `Assunto: ${campaign.subject}`;
    elements.previewFrame.srcdoc = campaign.htmlContent;
    elements.previewDialog.showModal();
    return;
  }
  openAction(button.dataset.action, card.dataset.campaignId);
});
document.querySelector("#open-create").addEventListener("click", openCreate);
document.querySelector("#empty-create").addEventListener("click", openCreate);
document.querySelector("#retry-campaigns").addEventListener("click", loadCampaigns);
elements.retryHealth.addEventListener("click", loadHealth);
elements.createForm.addEventListener("submit", submitCreate);
elements.actionForm.addEventListener("submit", submitAction);
document.querySelector("#open-source").addEventListener("click", () => {
  elements.sourceForm.reset();
  setHidden(elements.sourceError, true);
  elements.sourceDialog.showModal();
});
document.querySelector("#open-audience").addEventListener("click", () => {
  elements.audienceForm.reset();
  setHidden(elements.audienceError, true);
  elements.audienceDialog.showModal();
});
elements.sourceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.sourceForm.reportValidity()) return;
  const data = new FormData(elements.sourceForm);
  try {
    await api("/sources", { method: "POST", body: JSON.stringify(Object.fromEntries(data)) });
    elements.sourceDialog.close();
    notify("Fonte adicionada. O n8n poderá incluí-la na próxima coleta.");
    await loadWorkspace();
  } catch (error) {
    elements.sourceError.textContent = errorMessage(error, "Não foi possível salvar a fonte.");
    setHidden(elements.sourceError, false);
  }
});
elements.audienceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.audienceForm.reportValidity()) return;
  const data = new FormData(elements.audienceForm);
  const payload = Object.fromEntries(data);
  payload.emails = [...new Set(String(payload.emails || "").split(/[\n,;]+/).map((email) => email.trim().toLowerCase()).filter(Boolean))];
  payload.recipientCount = payload.emails.length;
  try {
    await api("/audiences", { method: "POST", body: JSON.stringify(payload) });
    elements.audienceDialog.close();
    notify("Audiência criada.");
    await loadWorkspace();
  } catch (error) {
    elements.audienceError.textContent = errorMessage(error, "Não foi possível salvar a audiência.");
    setHidden(elements.audienceError, false);
  }
});
elements.sessionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!elements.sessionForm.reportValidity()) return;
  state.adminId = elements.sessionAdmin.value.trim();
  state.token = elements.sessionToken.value;
  sessionStorage.setItem("avila.adminId", state.adminId);
  sessionStorage.setItem("avila.adminToken", state.token);
  elements.sessionStatus.textContent = `Sessão ativa: ${state.adminId}`;
  elements.openCreate.disabled = false;
  await Promise.all([loadCampaigns(), loadWorkspace()]);
});
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => elements.createDialog.close()));
document.querySelectorAll("[data-close-action]").forEach((button) => button.addEventListener("click", () => elements.actionDialog.close()));
document.querySelectorAll("[data-close-source]").forEach((button) => button.addEventListener("click", () => elements.sourceDialog.close()));
document.querySelectorAll("[data-close-audience]").forEach((button) => button.addEventListener("click", () => elements.audienceDialog.close()));
document.querySelectorAll("[data-close-preview]").forEach((button) => button.addEventListener("click", () => elements.previewDialog.close()));

for (const dialog of [elements.createDialog, elements.actionDialog]) {
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const clickedBackdrop = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (clickedBackdrop) dialog.close();
  });
}

elements.sessionAdmin.value = state.adminId;
elements.sessionToken.value = state.token;
elements.sessionStatus.textContent = state.token ? `Sessão ativa: ${state.adminId}` : "Sessão não configurada";
elements.openCreate.disabled = !state.token;
Promise.all([loadCampaigns(), loadHealth(), loadWorkspace()]);
