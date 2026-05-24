# AFO Toolsmith Repo Analysis Feature

**status:** proposed
**priority:** high
**created:** 2026-05-24
**from:** Jared / ChatGPT
**product:** AFO Toolsmith
**feature type:** premium / paid analysis

---

## 1. Core Idea

AFO Toolsmith should support a **repo analysis** capability.

A user should be able to provide a GitHub repo, or upload project files such as:

```txt
README.md
html.spec
TOOLSMITH.md
project specs
package files
schema files
```

Then Toolsmith should analyze the project and produce a validated, improved Toolsmith plan:

```txt
complete MCP list
existing tools to connect
missing tools to generate
recommended belts / workcells
belt ordering
risk profile
approval checklist
updated TOOLSMITH.md
```

This turns Toolsmith from a single-tool generator into a project workcell planner.

---

## 2. Why This Matters

Jared's new project pattern is:

```txt
README.md
+ html.spec
+ TOOLSMITH.md
= project-ready Toolsmith input
```

The `TOOLSMITH.md` file declares what tools and belts the project needs. But most users will need help producing or validating it.

Repo Analysis should let a user say:

```txt
Here is my repo. Tell me what MCPs I need, what belts I should create, what tools already exist, what tools must be generated, and what should be approved before build.
```

This is likely a premium feature because it requires LLM review, repo reading, semantic analysis, and structured tool/belt planning.

---

## 3. Product Name Options

```txt
Repo Review
Repo Analysis
Toolsmith Project Review
Workcell Planner
Belt Planner
Toolsmith Audit
Project-to-Workcell Analysis
```

Recommended product name:

```txt
Repo Analysis
```

Recommended tagline:

```txt
Upload a repo. Get the tools, belts, and workcells you need.
```

---

## 4. User Flow

### Flow A — GitHub Repo URL

```txt
1. User enters GitHub repo URL.
2. Toolsmith fetches repo metadata and key files.
3. Toolsmith detects README, html.spec, TOOLSMITH.md, package files, docs, schemas.
4. LLM analyzes project intent and required tool surface.
5. Toolsmith compares requested tools against existing catalogue.
6. Toolsmith marks each tool as:
   - available
   - missing / generate
   - needs approval
   - unsafe / requires human review
7. Toolsmith proposes belts/workcells.
8. User approves or edits.
9. Toolsmith creates/updates TOOLSMITH.md.
10. Toolsmith optionally creates belts and generates missing MCPs.
```

### Flow B — File Upload

```txt
1. User uploads README.md, html.spec, TOOLSMITH.md, or zip of project docs.
2. Toolsmith parses and analyzes files.
3. Toolsmith produces the same tool/belt/workcell review.
```

### Flow C — Existing TOOLSMITH.md Review

```txt
1. User uploads or points to TOOLSMITH.md.
2. Toolsmith checks if the MCP list is complete.
3. Toolsmith checks whether belts preserve the Comms Spine.
4. Toolsmith validates risk levels.
5. Toolsmith updates the file and marks it ready for approval.
```

---

## 5. Inputs

```json
{
  "repo_url": "https://github.com/nothinginfinity/drivemind",
  "files": [
    "README.md",
    "docs/drivemind-app.html.spec",
    "TOOLSMITH.md"
  ],
  "analysis_mode": "quick | standard | deep",
  "output_mode": "report | update_toolsmith_md | create_belts | generate_missing_tools",
  "budget_cents": 25
}
```

---

## 6. Outputs

```json
{
  "project_name": "DriveMind",
  "summary": "Local-first iPhone external SSD knowledge base with optional Cloudflare Temp Cloud workspaces.",
  "existing_tools_to_connect": [],
  "missing_tools_to_generate": [],
  "recommended_workcells": [],
  "belt_order": [],
  "risk_review": [],
  "toolsmith_md_status": "approved | needs_changes | missing",
  "updated_toolsmith_md": "...",
  "estimated_cost_cents": 25
}
```

---

## 7. Analysis Checks

Toolsmith Repo Analysis should check:

### Project Understanding

- What is the project?
- Who is the user?
- Is it local-first, cloud-first, mobile-first, enterprise, personal, etc.?
- What runtime does it need?
- What data sources does it need?

### File Completeness

- Is there a `README.md`?
- Is there an `html.spec` or UI spec?
- Is there a `TOOLSMITH.md`?
- Are there schemas, API specs, docs, roadmap files?
- Are there missing product specs?

### MCP Completeness

- What existing MCPs should be connected?
- What missing MCPs need to be generated?
- Which MCPs are safe/read-only?
- Which MCPs are dev-only/high-power?
- Which MCPs require secrets or special bindings?

### Belt / Workcell Quality

- Does every serious belt preserve the Comms Spine?
- Are task tools separated from read-only tools?
- Are destructive tools isolated into dev-only belts?
- Are belts ordered from safest to most powerful?
- Does each belt have a purpose and expiration?

### Approval Readiness

- Is the plan safe enough to approve?
- What needs human approval?
- What should be generated first?
- What should be deferred?

---

## 8. Required Repo Analysis MCP Tools

AFO Toolsmith may need a dedicated MCP or internal tool group:

```txt
repo_analysis_mcp
```

Suggested tools:

```txt
fetch_repo_summary
fetch_project_files
analyze_project_files
extract_toolsmith_manifest
validate_toolsmith_manifest
compare_manifest_to_catalogue
recommend_missing_mcps
recommend_workcells
price_repo_analysis
update_toolsmith_md
create_repo_analysis_report
```

---

## 9. Tool: `analyze_repo_for_toolsmith`

Purpose:

```txt
Analyze a repo or uploaded project files and produce a Toolsmith tool/belt/workcell plan.
```

Input schema:

```json
{
  "type": "object",
  "properties": {
    "repo_url": { "type": "string" },
    "owner": { "type": "string" },
    "repo": { "type": "string" },
    "branch": { "type": "string", "default": "main" },
    "include_paths": {
      "type": "array",
      "items": { "type": "string" }
    },
    "analysis_mode": {
      "type": "string",
      "enum": ["quick", "standard", "deep"],
      "default": "standard"
    },
    "output_mode": {
      "type": "string",
      "enum": ["report", "toolsmith_md_patch", "belt_plan", "full"],
      "default": "full"
    }
  }
}
```

Output schema:

```json
{
  "project_summary": "string",
  "files_reviewed": ["string"],
  "existing_tools_to_connect": [
    {
      "name": "string",
      "reason": "string",
      "belt": "string"
    }
  ],
  "missing_tools_to_generate": [
    {
      "name": "string",
      "problem": "string",
      "inputs": [],
      "outputs": [],
      "risk": "string",
      "target_belts": []
    }
  ],
  "recommended_workcells": [
    {
      "name": "string",
      "purpose": "string",
      "connectors": [],
      "risk": "string"
    }
  ],
  "approval_items": [],
  "updated_toolsmith_md": "string"
}
```

---

## 10. UI Requirements

Add a Repo Analysis screen to AFO Toolsmith.

### Upload / Input Panel

Fields:

```txt
GitHub repo URL
Upload README.md
Upload html.spec
Upload TOOLSMITH.md
Analysis mode: Quick / Standard / Deep
Output: Report / Update TOOLSMITH.md / Create belts / Generate tools
```

### Analysis Results

Sections:

```txt
Project Summary
Files Reviewed
Existing MCPs Found
Missing MCPs to Generate
Recommended Belts / Workcells
Risk Review
Approval Checklist
Cost Estimate
```

### Actions

```txt
Approve TOOLSMITH.md
Download TOOLSMITH.md
Commit TOOLSMITH.md to repo
Create belts
Generate missing MCPs
Run deeper analysis
```

---

## 11. Pricing Idea

Repo Analysis can be a premium feature.

Starter idea:

```txt
Quick analysis: $0.25
Standard analysis: $1.00
Deep repo analysis: usage-based / token-based
```

Pricing should depend on:

```txt
repo size
number of files analyzed
LLM tokens used
whether deep semantic search is used
whether missing tools are generated
```

This should be positioned as:

```txt
Save hours of setup by getting a complete tool/belt/workcell plan for your repo.
```

---

## 12. Safety and Billing Rules

- Always show estimated cost before running paid analysis.
- Never analyze private repos without explicit auth/permission.
- Never generate high-power tools without user approval.
- Never create destructive belts by default.
- Always separate safe/read-only belts from dev-only/high-power belts.
- Always preserve the Comms Spine in serious project workcells.
- Make `TOOLSMITH.md` reviewable before approval.

---

## 13. DriveMind Example

For DriveMind, Repo Analysis should identify:

Existing MCPs:

```txt
GitHub MCP
Vector Lab MCP
Toolsmith Admin MCP
mcp-prax
Cloudflare Auditor MCP
```

Missing MCPs:

```txt
agent-bridge-comms-mcp
drivemind-mcp
drivemind-temp-cloud-mcp
mobile-code-packet-mcp
remote-build-bridge-mcp
swift-playground-packager-mcp
pythonista-prototype-packet-mcp
cloudflare-multipart-mcp
```

Recommended workcells:

```txt
DriveMind Builder Workcell
DriveMind Prototype Workcell
Personal Knowledge Workcell
Cloudflare Workspace Workcell
```

Approval result:

```txt
TOOLSMITH.md needs review, then approval.
```

---

## 14. Product Doctrine

This feature reinforces:

```txt
Workcells > Swarms
```

Repo Analysis is how Toolsmith turns a repo into a workcell plan.

---
