const companyList = document.getElementById("company-list");
const searchInput = document.getElementById("search");
const toggleNew = document.getElementById("toggle-new");
const lastUpdated = document.getElementById("last-updated");
const summary = document.getElementById("summary");

const state = {
  companies: [],
  query: "",
  onlyNew: false,
};

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
};

const buildLogo = (company) => {
  const initials = company.name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return `<div class="company-logo">${initials || "LW"}</div>`;
};

const jobCard = (job) => {
  const badges = job.isNew ? `<span class="badge">New</span>` : "";
  const salary = job.salary ? `<div class="salary">Salary: ${job.salary}</div>` : "";

  return `
    <div class="job-card">
      <div class="badges">${badges}</div>
      <a href="${job.url}" target="_blank" rel="noreferrer">${job.title}</a>
      ${salary}
    </div>
  `;
};

const companyCard = (company) => {
  const jobs = company.jobs.length
    ? company.jobs.map(jobCard).join("")
    : `<div class="empty">No jobs detected yet. Check the careers site directly.</div>`;

  return `
    <article class="company-card">
      <div class="company-header">
        ${buildLogo(company)}
        <div class="company-meta">
          <strong>${company.name}</strong>
          <a href="${company.website}" target="_blank" rel="noreferrer">Visit career site</a>
          <span>${company.totalJobs} roles detected</span>
        </div>
      </div>
      <div class="job-list">${jobs}</div>
    </article>
  `;
};

const render = () => {
  const query = state.query.toLowerCase();
  const filtered = state.companies
    .map((company) => {
      const jobs = company.jobs.filter((job) => {
        const haystack = `${company.name} ${job.title}`.toLowerCase();
        const matchesQuery = !query || haystack.includes(query);
        const matchesNew = !state.onlyNew || job.isNew;
        return matchesQuery && matchesNew;
      });

      return {
        ...company,
        jobs,
        totalJobs: jobs.length,
      };
    })
    .filter((company) => company.jobs.length || !state.onlyNew);

  companyList.innerHTML = filtered.length
    ? filtered.map(companyCard).join("")
    : `<div class="empty">No roles match your filters. Try another search.</div>`;
};

const init = async () => {
  const response = await fetch("data.json");
  const data = await response.json();

  state.companies = data.companies || [];
  lastUpdated.textContent = `Last updated: ${formatDate(data.generatedAt)}`;
  summary.textContent = `${data.totalCompanies} companies · ${data.totalJobs} roles`;

  render();
};

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  render();
});

toggleNew.addEventListener("change", (event) => {
  state.onlyNew = event.target.checked;
  render();
});

init();
