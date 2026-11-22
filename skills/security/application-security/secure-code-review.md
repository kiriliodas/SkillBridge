# Secure Code Review

Use for a defensive review of code you own or are authorised to assess: finding how it can
be abused before someone else does. Not for offensive work, and not for systems you have no
permission to test.

## Scope and authorisation

- Confirm what is in scope before reviewing: which repository, which branch, which deployment.
- Reviewing code you were handed is authorised; probing a live third-party system is not. When in doubt, review statically and say what you did not test.
- For anything with personal data, note data-protection obligations and avoid copying real data into examples or reports.

## Where vulnerabilities actually are

Spend effort in this order; it matches both frequency and impact.

1. **Trust boundaries.** Every place data crosses from less trusted to more trusted: HTTP handlers, file uploads, webhooks, queue consumers, parsers, deserialisers, CLI arguments.
2. **Authorisation.** Not "is the user logged in" but "may *this* user act on *this* object". Missing object-level checks are the most common serious flaw.
3. **Sinks.** Query construction, shell execution, template rendering, HTML output, file paths, deserialisation, redirect targets, outbound requests (SSRF).
4. **Secrets and credentials.** In code, logs, error messages, URLs, client bundles, CI configuration.
5. **Dependencies and supply chain.** See the supply-chain skill for depth.

## The checks that catch the most

**Injection**

- SQL: parameterised queries only. String-built SQL with user data is a finding even if it "only" comes from an authenticated user.
- Shell: no string interpolation into a shell. Use argument arrays; never `shell=True`/`exec` with input.
- Paths: normalise and confine to a base directory; reject `..` after normalisation, not before.
- HTML: escape at output; a sanitiser is required only when HTML must be allowed, and its allowlist must be explicit.
- Deserialisation: no native object deserialisation of untrusted input (pickle, Java serialisation, PHP unserialise, YAML `load` without a safe loader).

**Authorisation**

- Every object read or write checks ownership or role on the server, not in the UI.
- No trust in client-supplied identity: ids, roles, tenant ids and prices from the request body are untrusted.
- Deny by default: a new route without an explicit authorisation decision should fail closed.

**Session and authentication**

- Cookies: `HttpOnly`, `Secure`, `SameSite`; no tokens in URLs or logs.
- Password storage: a memory-hard KDF (Argon2id, scrypt, bcrypt), never a raw hash.
- Rate limiting on authentication, password reset and any token-checking endpoint.
- Session invalidation on logout and privilege change.

**Data exposure**

- Error responses reveal the failure, not the stack, the SQL, or the upstream body.
- Logs exclude secrets, tokens and personal data; log correlation ids instead.
- API responses return only the fields the caller needs; an oversharing serializer leaks columns added later.

**Cryptography**

- Use the platform's high-level library; do not compose primitives.
- No MD5/SHA-1 for integrity or passwords; no ECB; random nonces never reused; constant-time comparison for secrets.

## Reporting

One finding per entry, with:

- **Location** — file and line, or endpoint.
- **Class** — injection, broken access control, etc.
- **Preconditions** — who must be able to do what to exploit it (authentication level, configuration).
- **Impact** — what an attacker gains, in concrete terms.
- **Evidence** — the code path, quoted precisely.
- **Fix** — the specific change, plus the safer pattern to adopt.
- **Confidence** — confirmed by reading the code versus suspected.

Rank by exploitability × impact, and separate confirmed findings from hypotheses. A report
that lists 40 theoretical issues and no prioritisation is not actionable.

## Honesty constraints

- Do not write exploits, working payloads against live targets, or evasion techniques. Describe the class and the fix.
- Do not claim a vulnerability is exploitable without tracing the full path from input to sink, including any validation in between.
- Model-generated security findings need verification. Label anything you inferred but did not confirm by reading the complete path.
