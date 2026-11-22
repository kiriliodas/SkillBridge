# Linux Incident Triage

Use to investigate a Linux host that is behaving abnormally — unexplained CPU, unexpected
network connections, a suspected compromise — on systems you own or administer.

## Rules before touching the host

- **Preserve evidence before changing anything.** Memory state and running processes disappear on reboot.
- **Do not run random binaries or install tools on a suspect host.** Use what is already there, or copy binaries in.
- Work read-only until you have a hypothesis. Every command that modifies state destroys part of the evidence.
- If the host may hold personal data, keep captured output minimal and store it where it is protected.

## Triage sequence

### 1. Establish what is actually abnormal

```bash
uptime                          # load average vs. CPU count
ps -eo pid,ppid,user,%cpu,%mem,etime,cmd --sort=-%cpu | head -20
free -m; df -h; df -i           # memory, disk, inodes
```

A baseline matters more than the absolute values. A process at 90% CPU may be the normal
backup job; note what started recently (`etime` small) rather than what is merely large.

### 2. Processes

```bash
ps -eo pid,ppid,user,stat,lstart,cmd --sort=start_time | tail -20
ls -l /proc/<pid>/exe           # binary actually running (detects deleted/replaced files)
ls -l /proc/<pid>/cwd
cat /proc/<pid>/cmdline | tr '\0' ' '
```

Smells: a binary executed from `/tmp`, `/dev/shm` or a user home; a process whose `exe` is
marked `(deleted)`; a name that imitates a system daemon but with an unusual path; a
process with no parent left (PPID 1) that did not come from a service manager.

### 3. Network

```bash
ss -tulpn                       # listening sockets and owning process
ss -tnp state established       # current connections
```

Judge by destination: outbound connections to unknown public addresses from a service that
should not make any. Resolve the address and check the port against the service's expected
behaviour before declaring it exfiltration.

### 4. Persistence and accounts

```bash
systemctl list-units --type=service --state=running
crontab -l; ls -la /etc/cron.*; cat /etc/crontab
cat /etc/passwd | awk -F: '$3>=1000'          # human accounts
getent group sudo; lastlog | head             # privileged groups, recent logins
find /etc/systemd/system -newer /etc/hostname -name '*.service'
```

Most persistence survives a reboot: an unfamiliar unit file, a cron entry pointing at a
script in a temporary directory, a new sudo-capable account.

### 5. Files changed around the suspected time

```bash
find / -xdev -newermt '-2 hours' -type f \
  -not -path '/proc/*' -not -path '/sys/*' -not -path '/var/log/*' 2>/dev/null | head -50
```

Look at `/tmp`, `/dev/shm`, `/var/tmp` explicitly — those are the usual drop locations.

### 6. Logs

```bash
journalctl --since '-2 hours' -p warning
journalctl -u ssh --since '-24 hours' | grep -i 'accepted\|failed'
tail -100 /var/log/auth.log
```

Correlate: a login event followed by a new process followed by an outbound connection is a
narrative; three unrelated oddities are not.

## Containment, once you have an answer

In order of preference, and only with the owner's agreement:

1. Isolate the network path (security group, firewall rule) rather than killing processes.
2. Snapshot the disk before cleanup, if the provider supports it.
3. Preserve the suspicious binaries and the relevant logs somewhere off-host.
4. Do not "clean" the host and continue using it. A compromised host is rebuilt from a known-good image.

## Reporting

State: what was observed (with the exact command and output that shows it), what was ruled
out, what remains unexplained, and the recommended next step. Distinguish an observation
("outbound connection to 203.0.113.5:443 from pid 8123") from an interpretation
("likely command-and-control") — the first is evidence, the second is a hypothesis.

## Limits

This is triage, not forensic analysis: no memory capture, no disk imaging, no timeline
reconstruction of a determined adversary. If the host is critical or the attacker
sophisticated, say so and recommend a specialist. Never claim a host is clean because no
indicator was found — absence of evidence on a first-pass triage is not evidence of absence.
