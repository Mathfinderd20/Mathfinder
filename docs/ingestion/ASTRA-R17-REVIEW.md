**R17 recommendation: preserve verified application automation separately from imported facts. Do not activate the blanket progression bypass.** I read the addendum and relevant implementation; I did not modify code or run tests.

1. **Class progression:** `completeCoreSpellProgression` does more than fill omissions: it replaces recognized legacy rows and supplies spell access and spells-known data. Retain verified behavior through a versioned runtime rule with evidence, explicit canonical class/system/version scope, and recorded derivation. Never serialize its outputs as scraped facts. Name plus casting type is insufficient to establish applicability. Verify slot, access, and spells-known behavior across supported levels and affected existing characters; compare against authoritative expectations as well as current behavior.

2. **Race bonuses:** Replace display-name merging with canonical race identity or an explicitly reviewed equivalence mapping. Preserve verified bonuses for the correct race without transferring them to same-named variants. Deduplicate bonuses by stable identity and surface conflicting definitions.

3. **Spell lookup:** Use canonical IDs for authoritative lookup. Keep name lookup only as a compatibility alias when it resolves uniquely. Collision blocking is a sound interim release safeguard, but must not silently discard legitimate variants or remap existing references.

4. **Additional finding:** Loaded classes are also indexed by lowercase display name. Extend collision checks to that path and any equivalent runtime registry. Otherwise distinct classes can be overwritten before progression rules run.

**Additional user decision:** Present a bounded R17 decision approving the specific verified progression rules and any race-equivalence mappings to retain, with affected entities, evidence, and before/after results. The previously approved staging transition does not settle this newly discovered behavior. Source eligibility remains a separate requirement; calling something “automation” does not exempt excluded contributions.

Implementation and comparison tests can proceed now. Activate only after R17’s substantive decisions and validation are complete. Production remains untouched.
