"""RecallOps Text Matching and Action Normalization Utilities.

Provides stemming, tokenization, semantic action parsing, negation stripping,
and robust violation detection for guardrail enforcement against previously-failed actions.
Prevents evasion through shortened actions, synonyms, pluralization, or phrasing variations
while strictly protecting unrelated diagnostic actions (e.g. inspect/check/scale) from false positives.
"""

from __future__ import annotations

import re
from typing import NamedTuple, Optional, Set

# ---------------------------------------------------------------------------
# Stopwords
# ---------------------------------------------------------------------------

_SYMPTOM_STOP = frozenset({
    "error", "errors", "failure", "failures", "issue", "issues",
    "high", "low", "spike", "spikes", "service", "services",
    "application", "applications", "the", "a", "an", "is", "was",
    "are", "in", "on", "to", "for", "of", "and", "with", "from",
    "that", "this", "it", "be", "has", "had", "have", "been",
    "not", "but", "or", "by", "at", "as", "no", "all", "more",
    "than", "very", "its", "our", "we", "they", "their",
})

_ACTION_STOP = frozenset({
    "application", "applications", "app", "apps",
    "service", "services", "instance", "instances",
    "server", "servers", "node", "nodes", "manually",
    "the", "a", "an", "is", "was", "are", "in", "on", "to",
    "for", "of", "and", "with", "from", "that", "this", "it",
    "be", "has", "had", "have", "been", "not", "but", "or",
    "by", "at", "as", "no", "all", "more", "than", "very",
})

# ---------------------------------------------------------------------------
# Action and Resource Semantic Taxonomies
# ---------------------------------------------------------------------------

_VERB_FAMILIES = {
    # RESTART family
    "restart": "RESTART", "restarting": "RESTART", "restarted": "RESTART",
    "reboot": "RESTART", "rebooting": "RESTART", "rebooted": "RESTART",
    "bounce": "RESTART", "bouncing": "RESTART", "bounced": "RESTART",
    "cycle": "RESTART", "cycling": "RESTART", "cycled": "RESTART",
    "reset": "RESTART", "resetting": "RESTART",
    "kill": "RESTART", "killing": "RESTART", "killed": "RESTART",

    # INSPECT family (diagnostic / non-mutating)
    "inspect": "INSPECT", "inspecting": "INSPECT", "inspected": "INSPECT",
    "check": "INSPECT", "checking": "INSPECT", "checked": "INSPECT",
    "investigate": "INSPECT", "investigating": "INSPECT", "investigated": "INSPECT",
    "query": "INSPECT", "querying": "INSPECT", "queried": "INSPECT",
    "view": "INSPECT", "viewing": "INSPECT", "viewed": "INSPECT",
    "monitor": "INSPECT", "monitoring": "INSPECT", "monitored": "INSPECT",
    "review": "INSPECT", "reviewing": "INSPECT", "reviewed": "INSPECT",
    "analyze": "INSPECT", "analyzing": "INSPECT", "analyzed": "INSPECT",
    "observe": "INSPECT", "observing": "INSPECT", "observed": "INSPECT",
    "verify": "INSPECT", "verifying": "INSPECT", "verified": "INSPECT",
    "audit": "INSPECT", "auditing": "INSPECT", "audited": "INSPECT",
    "tail": "INSPECT", "tailing": "INSPECT",
    "profile": "INSPECT", "profiling": "INSPECT",

    # SCALE family
    "scale": "SCALE", "scaling": "SCALE", "scaled": "SCALE",
    "resize": "SCALE", "resizing": "SCALE", "resized": "SCALE",
    "upscale": "SCALE", "downscale": "SCALE", "autoscale": "SCALE",

    # INCREASE family
    "increase": "INCREASE", "increasing": "INCREASE", "increased": "INCREASE",
    "raise": "INCREASE", "raising": "INCREASE", "raised": "INCREASE",
    "bump": "INCREASE", "bumping": "INCREASE", "bumped": "INCREASE",
    "boost": "INCREASE", "boosting": "INCREASE", "boosted": "INCREASE",
    "expand": "INCREASE", "expanding": "INCREASE", "expanded": "INCREASE",
    "enlarge": "INCREASE", "enlarging": "INCREASE",
    "grow": "INCREASE", "growing": "INCREASE",

    # DECREASE family
    "decrease": "DECREASE", "decreasing": "DECREASE", "decreased": "DECREASE",
    "reduce": "DECREASE", "reducing": "DECREASE", "reduced": "DECREASE",
    "lower": "DECREASE", "lowering": "DECREASE", "lowered": "DECREASE",
    "shrink": "DECREASE", "shrinking": "DECREASE",
    "throttle": "DECREASE", "throttling": "DECREASE",

    # FLUSH family
    "flush": "FLUSH", "flushing": "FLUSH", "flushed": "FLUSH",
    "clear": "FLUSH", "clearing": "FLUSH", "cleared": "FLUSH",
    "purge": "FLUSH", "purging": "FLUSH", "purged": "FLUSH",
    "drain": "FLUSH", "draining": "FLUSH", "drained": "FLUSH",
    "empty": "FLUSH", "emptying": "FLUSH",
    "evict": "FLUSH", "evicting": "FLUSH",

    # ROLLBACK family
    "rollback": "ROLLBACK", "revert": "ROLLBACK", "reverting": "ROLLBACK",
    "reverted": "ROLLBACK", "undo": "ROLLBACK", "downgrade": "ROLLBACK",

    # DEPLOY / PATCH family
    "deploy": "DEPLOY", "deploying": "DEPLOY", "deployed": "DEPLOY",
    "rollout": "DEPLOY", "upgrade": "DEPLOY", "upgrading": "DEPLOY", "upgraded": "DEPLOY",
    "patch": "DEPLOY", "patching": "DEPLOY", "patched": "DEPLOY",
    "update": "DEPLOY", "updating": "DEPLOY", "updated": "DEPLOY",

    # FAILOVER family
    "failover": "FAILOVER", "switch": "FAILOVER", "switching": "FAILOVER",
    "redirect": "FAILOVER", "redirecting": "FAILOVER", "reroute": "FAILOVER",
}

_RESOURCE_FAMILIES = {
    "pod": "COMPUTE_UNIT", "pods": "COMPUTE_UNIT",
    "container": "COMPUTE_UNIT", "containers": "COMPUTE_UNIT",
    "instance": "COMPUTE_UNIT", "instances": "COMPUTE_UNIT",
    "worker": "COMPUTE_UNIT", "workers": "COMPUTE_UNIT",
    "node": "COMPUTE_UNIT", "nodes": "COMPUTE_UNIT",
    "process": "COMPUTE_UNIT", "processes": "COMPUTE_UNIT",
    "deployment": "COMPUTE_UNIT", "deployments": "COMPUTE_UNIT",
    "task": "COMPUTE_UNIT", "tasks": "COMPUTE_UNIT",

    "pool": "CONNECTION_POOL", "pools": "CONNECTION_POOL",
    "connection": "CONNECTION_POOL", "connections": "CONNECTION_POOL",
    "conn": "CONNECTION_POOL", "conns": "CONNECTION_POOL",
    "socket": "CONNECTION_POOL", "sockets": "CONNECTION_POOL",
    "pgbouncer": "CONNECTION_POOL",

    "cache": "CACHE", "caches": "CACHE",
    "redis": "CACHE", "memcached": "CACHE",
    "session": "CACHE", "sessions": "CACHE",

    "db": "DATABASE", "database": "DATABASE", "postgres": "DATABASE", "mysql": "DATABASE",

    "jwt": "AUTH_KEY", "token": "AUTH_KEY", "tokens": "AUTH_KEY",
    "key": "AUTH_KEY", "keys": "AUTH_KEY", "secret": "AUTH_KEY", "secrets": "AUTH_KEY",
    "cert": "AUTH_KEY", "certs": "AUTH_KEY",

    "queue": "QUEUE", "queues": "QUEUE",
    "rabbitmq": "QUEUE", "kafka": "QUEUE", "broker": "QUEUE",
    "dlq": "QUEUE", "deadletter": "QUEUE",

    "memory": "RESOURCE_LIMIT", "ram": "RESOURCE_LIMIT", "cpu": "RESOURCE_LIMIT",
    "heap": "RESOURCE_LIMIT", "limit": "RESOURCE_LIMIT", "limits": "RESOURCE_LIMIT",

    "timeout": "TIMEOUT", "timeouts": "TIMEOUT", "deadline": "TIMEOUT",

    "smtp": "NETWORK_GATEWAY", "relay": "NETWORK_GATEWAY", "gateway": "NETWORK_GATEWAY",
    "proxy": "NETWORK_GATEWAY", "dns": "NETWORK_GATEWAY",
}

_KNOWN_TARGETS = {
    "payment", "auth", "notification", "recommendation", "transcoder", "checkout",
    "order", "user", "redis", "postgres", "smtp", "rabbitmq", "api", "database", "db",
}

# ---------------------------------------------------------------------------
# Stemmer
# ---------------------------------------------------------------------------


def stem(word: str) -> str:
    """Tiny suffix stemmer.

    Handles: plural s/ies/sses, -ing, -ed, trailing e.
    """
    if len(word) <= 3:
        return word

    # -sses -> -ss
    if word.endswith("sses"):
        return word[:-2]

    # -ies -> -i  (e.g. queries -> queri)
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "i"

    # -ing
    if word.endswith("ing") and len(word) > 5:
        base = word[:-3]
        # double consonant: restarting -> restart
        if len(base) >= 2 and base[-1] == base[-2]:
            return base[:-1]
        return base

    # -ed
    if word.endswith("ed") and len(word) > 4:
        base = word[:-2]
        if len(base) >= 2 and base[-1] == base[-2]:
            return base[:-1]
        return base

    # plural -s (but not -ss)
    if word.endswith("s") and not word.endswith("ss") and len(word) > 3:
        return word[:-1]

    # trailing -e  (only if resulting base is >=3)
    if word.endswith("e") and len(word) > 4:
        return word[:-1]

    return word


# ---------------------------------------------------------------------------
# Tokenizers
# ---------------------------------------------------------------------------


def _tokenize(text: str) -> list[str]:
    """Lowercase alphanumeric tokens from text."""
    return re.findall(r"[a-z0-9]+", text.lower())


def symptom_tokens(text: str) -> Set[str]:
    """Stemmed tokens for symptom matching (removes symptom stopwords)."""
    return {stem(w) for w in _tokenize(text) if w not in _SYMPTOM_STOP and len(w) > 1}


def action_tokens(text: str) -> Set[str]:
    """Stemmed tokens for action matching (removes action stopwords)."""
    return {stem(w) for w in _tokenize(text) if w not in _ACTION_STOP and len(w) > 1}


# ---------------------------------------------------------------------------
# Negation stripping
# ---------------------------------------------------------------------------

_NEGATION_PAREN = re.compile(r"\([^)]*\)")
_NEGATION_CLAUSE = re.compile(
    r"\b(?:do\s+not|don't|never|avoid|instead\s+of|rather\s+than|without|not)\b.*",
    re.IGNORECASE,
)


def strip_negations(text: str) -> str:
    """Remove parenthetical text and clauses starting with negation words.

    Example: "Check pool (do NOT restart pods)" -> "Check pool "
    """
    text = _NEGATION_PAREN.sub("", text)
    text = _NEGATION_CLAUSE.sub("", text)
    return text.strip()


# ---------------------------------------------------------------------------
# Structured Action Parser
# ---------------------------------------------------------------------------


class ParsedAction(NamedTuple):
    raw: str
    action_verb: Optional[str]
    action_family: Optional[str]
    resource: Optional[str]
    resource_family: Optional[str]
    targets: Set[str]
    tokens: Set[str]


def parse_action(text: str) -> ParsedAction:
    """Normalize and dissect an operational action into functional components.

    Extracts:
    - action_family: e.g. RESTART, INSPECT, SCALE, INCREASE, FLUSH
    - resource_family: e.g. COMPUTE_UNIT, CONNECTION_POOL, CACHE, AUTH_KEY
    - targets: specific service or component targets (e.g. payment, auth)
    - tokens: stemmed core action tokens
    """
    cleaned = strip_negations(text)
    toks = _tokenize(cleaned)

    action_verb: Optional[str] = None
    action_family: Optional[str] = None
    for t in toks:
        if t in _VERB_FAMILIES:
            action_verb = t
            action_family = _VERB_FAMILIES[t]
            break

    resource: Optional[str] = None
    resource_family: Optional[str] = None
    for t in toks:
        if t in _RESOURCE_FAMILIES:
            resource = t
            resource_family = _RESOURCE_FAMILIES[t]
            break

    targets = {t for t in toks if t in _KNOWN_TARGETS}
    toks_set = action_tokens(cleaned)

    return ParsedAction(
        raw=text,
        action_verb=action_verb,
        action_family=action_family,
        resource=resource,
        resource_family=resource_family,
        targets=targets,
        tokens=toks_set,
    )


# ---------------------------------------------------------------------------
# Action Equivalence & Violation Detection
# ---------------------------------------------------------------------------


def are_actions_equivalent(
    candidate: str,
    failed_action: str,
    context_service: Optional[str] = None,
) -> bool:
    """Evaluate whether candidate remediation action operationally matches failed_action.

    Correctly identifies:
    - Target omission / generalization: "Restart pods" vs "Restart payment pods" -> EQUIVALENT
    - Rephrased wording / synonyms: "Reboot payment containers" vs "Restart payment pods" -> EQUIVALENT
    - Pluralization: "Restart payment pod" vs "Restart payment pods" -> EQUIVALENT
    - Deployment variation: "Restart payment deployment" vs "Restart payment pods" -> EQUIVALENT

    Strictly protects non-equivalent actions from false positives:
    - "Inspect payment pods" vs "Restart payment pods" -> NOT EQUIVALENT
    - "Scale payment pods" vs "Restart payment pods" -> NOT EQUIVALENT
    - "Check database connections" vs "Restart payment pods" -> NOT EQUIVALENT
    - "Restart auth pods" vs "Restart payment pods" -> NOT EQUIVALENT
    """
    cand_stripped = strip_negations(candidate)
    if not cand_stripped.strip():
        return False

    p_cand = parse_action(cand_stripped)
    p_fail = parse_action(failed_action)

    # 1. Diagnostic inspections NEVER repeat mutating remediations
    if p_cand.action_family == "INSPECT" and p_fail.action_family != "INSPECT":
        return False

    # 2. Conflicting action families are not equivalent (e.g. SCALE vs RESTART, INCREASE vs FLUSH)
    if p_cand.action_family and p_fail.action_family:
        if p_cand.action_family != p_fail.action_family:
            return False

    # 3. Matching action families (e.g. both RESTART, or both FLUSH)
    if p_cand.action_family and p_fail.action_family and p_cand.action_family == p_fail.action_family:
        # Check resource compatibility
        if p_cand.resource_family and p_fail.resource_family:
            # Different resources (e.g. CACHE vs COMPUTE_UNIT)
            if p_cand.resource_family != p_fail.resource_family:
                return False

            # Both share resource family (e.g. COMPUTE_UNIT for pods/containers/instances)
            # Check target service compatibility
            if p_cand.targets and p_fail.targets:
                # Both specify targets: must have overlap
                if not (p_cand.targets & p_fail.targets):
                    return False
                return True

            # If candidate omitted target (e.g. "Restart pods" vs "Restart payment pods")
            # In incident context or generic compute action, candidate subsumes failed action
            if not p_cand.targets:
                if context_service:
                    # If context service specified and matches failed targets or general scope
                    ctx_lower = context_service.lower()
                    if any(t in ctx_lower for t in p_fail.targets) or not p_fail.targets:
                        return True
                return True

            # If failed action omitted target but candidate has target, candidate is more specific
            if not p_fail.targets:
                return True

    # 4. Token subset / subsumption check
    if p_cand.tokens and p_fail.tokens:
        # If candidate action is a subset of failed action (e.g. {"restart", "pod"} subset of {"restart", "payment", "pod"})
        if p_cand.tokens.issubset(p_fail.tokens) and len(p_cand.tokens) >= 2:
            return True
        # If failed action is a subset of candidate (e.g. "Restart pods" vs "Restart payment pods")
        if p_fail.tokens.issubset(p_cand.tokens) and len(p_fail.tokens) >= 2:
            return True

    return False


def violates(
    candidate: str,
    failed_action: str,
    threshold: float = 0.80,
    context_service: Optional[str] = None,
) -> bool:
    """Return True if candidate violates the failed_action guardrail.

    Uses the action equivalence layer first, then evaluates token overlap.
    Negations in candidate are stripped so warnings like
    "Check pool (do NOT restart pods)" will not trigger false violations.
    """
    if not candidate or not failed_action:
        return False

    candidate_stripped = strip_negations(candidate)
    if not candidate_stripped.strip():
        return False

    # 1. Structural semantic equivalence
    if are_actions_equivalent(candidate, failed_action, context_service=context_service):
        return True

    # 2. Token overlap fallback
    failed_toks = action_tokens(failed_action)
    if not failed_toks:
        return False
    candidate_toks = action_tokens(candidate_stripped)
    overlap = len(failed_toks & candidate_toks)

    if (overlap / len(failed_toks)) >= threshold:
        p_cand = parse_action(candidate_stripped)
        p_fail = parse_action(failed_action)
        if p_cand.action_family == "INSPECT" and p_fail.action_family != "INSPECT":
            return False
        return True

    return False


# ---------------------------------------------------------------------------
# Action normalization
# ---------------------------------------------------------------------------


def normalize_action(text: str) -> str:
    """Sorted-token key for de-duplication of actions."""
    toks = sorted(action_tokens(text))
    return " ".join(toks)
