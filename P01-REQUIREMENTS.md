# P01 implementation and acceptance checklist

Based on SEKA's 3 November 2026 three-part technical document. “Implemented” means code plus local verification, not live-service acceptance.

| Requirement | Implementation | Remaining acceptance |
|---|---|---|
| Laravel / PostgreSQL / Docker | Laravel retained, PostgreSQL configuration, additive migration, Docker handoff | Run migration/tests on a PostgreSQL staging copy; build and smoke-test Docker |
| Database design | Independent application aggregate, contacts, notes, reviews, grants, notifications, intake envelopes, attachments, sessions and cleanup queue | Review schema and indexes with professor/SEKA |
| Entra login and Azure roles | PKCE, state/nonce, RS256 verification, tenant/audience checks, OID identity, hashed sessions, Origin checks | Register client, approve role/unit claim names, test tenant, secret rotation and account revocation policy |
| Technical administrator | Configuration, unit/event/purpose dictionaries, process statuses; no default candidate access | Approve dictionary administration authority |
| HR coordinator | All applications and operational actions | Live tenant role assignment |
| Unit director | Own unit applications and operational actions | Confirm department membership and multiple-unit policy |
| Deputy | Explicit granted applications and operational actions | HR grant authority is provisional; approve before enabling live grants |
| HR support | Explicit application grants, operational actions | Scope/replacement rules remain a SEKA decision |
| BHP/OŚ director | Explicit cross-unit review access, comments/opinions and qualification confirmation | Confirm timing and terminology |
| Role assignment | Azure claims in live mode, demo accounts only locally | Legacy local role editor is hidden; it does not assign Azure roles |
| One mailbox | Fixed outbound/reply-to kariera@seka.pl; secure provider-ingest API; per-application conversations | Connect actual incoming provider/forwarder and SMTP; delivery/bounce handling and provider threading remain integration work |
| No applicant grouping | Same email can create separate applications; grouping endpoint retired | Review historical data preservation policy |
| No position objects | Free-text position; unit dictionary | Historic read-only position suggestions are values, not new position entities |
| Main/process statuses | Extensible process dictionary, derived main state; new complete/incomplete and interview validation | Approve six later-stage proposed statuses and transition policy; reopening blocked pending decision |
| Application fields | Source, unit, free-text position, owner, support/review flags, consent evidence | Approve evidence text and retention periods |
| Structured contacts | Event dictionary, purpose, phone outcome, occurred time, actor and status snapshot | Email purpose currently completed manually; no AI guessing |
| Structured notes | Separate append-only attributed notes with process snapshot | Existing legacy notes remain read-only |
| Technical history | Audit events and type filter, distinct from business contacts | Acceptance review |
| Manual entry | Dedicated manual form and private attachment upload | Acceptance review |
| Notifications | In-app messages, owner assignment and qualification results; scoped per recipient | Email/Teams delivery is not implemented in this update |
| Retention | Two configurable periods from completion, default dry run, explicit execution flag, cascading records and retriable file deletion | Approve durations, consent handling, legacy dates, backups/logs and operation schedule before enabling |
| Incoming AI agent | Existing deterministic preview plus human intake review; quarantine prevents automatic candidate creation | AI model, provider, DPA/security, spam classifier and agent orchestration are not implemented |
| Spam recovery | Separate pending/spam area, accept/restore/delete, attachments | Automatic spam scoring awaits approved agent |
| Completeness | New complete/incomplete based on CV/unit/position, manual correction | Confirm required fields with SEKA |
| Owner changes | Versioned ownership and tasks, branch-transfer safeguards | Acceptance review |
| Interviews / rejection / offers / board | Statuses, scheduled date/format, rejection reason, contact records | No calendar invitations, board approval integration or legally final decisions generated automatically |
| Qualification process | Separate opinion vs confirmation, named reviewer, versioned pending decision and notification | Approval/rejection does not automatically decide recruitment outcome |
| UI | New light navy/teal responsive workspace, compact tables and process panels | SEKA usability/accessibility review and supported-browser acceptance |

## Decisions that must not be silently invented

1. Confirm who grants/revokes record access, expiry, HR-support replacement scope and multiple units. Live discretionary grants/review requests require `SEKA_GRANT_POLICY_APPROVED=true` after approval.
2. Approve Azure role values and `SEKA.Unit.<unit-code>` role claim convention. Current implementation accepts exactly one business role and one unit for a unit director; ambiguous roles fail closed.
3. Approve the full later-stage dictionary, permitted transitions and reopening/completion-date policy. The initial nine dictionary statuses and six proposed later statuses are seeded alongside legacy statuses for compatibility.
4. Specify AI provider/model, data boundaries, security, mailbox transport, spam thresholds and purpose extraction. Current extraction is deterministic and reviewable.
5. Specify qualification timing and HR support scope. Initial opinions are nonbinding; confirmation is separate.
6. Set two retention periods and legal evidence requirements. Unknown historical completion dates are not invented. Purging application data does not erase infrastructure backups, SMTP-provider records or external logs; their lifecycle needs its own approved procedure.
7. Decide live account deactivation/role refresh expectations: role claims are checked at sign-in; server sessions expire within one hour / token expiry. Immediate Azure revocation sync is not supplied.

## Operational limitations

Incoming email is accepted through a shared-secret API adapter, not polled directly from Microsoft Graph/IMAP. Matching replies to an existing application currently requires HR to select the application UUID and confirm the sender. Sending requires explicit user confirmation. An uncertain SMTP outcome is not automatically retried, avoiding duplicate messages; operators must reconcile provider logs. No production credentials are included.

Testing here uses SQLite. PostgreSQL, Docker and live provider checks are mandatory staging acceptance work. This package does not supersede SEKA's unresolved business decisions.
