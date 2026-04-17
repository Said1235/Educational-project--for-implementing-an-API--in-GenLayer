# { "Depends": "py-genlayer:test" }
# ↑ REQUIRED — must be the first line. Tells GenVM which SDK version to use.

from genlayer import *
import json
import typing

# ════════════════════════════════════════════════════════════════
#  MyGenLayerContract — Didactic Template
#
#  This is a minimal, production-ready Intelligent Contract for GenLayer.
#  Copy it, rename the class, and adapt the storage + methods to your use case.
#
#  DEPLOY:
#    1. Go to studio.genlayer.com
#    2. Paste this file
#    3. Click Deploy
#    4. Copy the contract address
#    5. Set CONTRACT_ADDRESS=0x... in your API .env
#
#  STORAGE RULES (important!):
#    ✓  str, bool, bigint, u8/u16/u32/u64/u128 are supported
#    ✗  int   → NOT supported (use str or bigint)
#    ✗  float → NOT supported (use str, e.g. "0.85")
#    ✗  list/dict as storage fields → NOT supported
#       (use TreeMap[str, str] instead)
# ════════════════════════════════════════════════════════════════


class MyGenLayerContract(gl.Contract):

    # ── Persistent on-chain storage ───────────────────────────────────────
    # All values stored as strings — GenLayer's storage system requirement.
    # These survive between transactions and are readable by anyone.

    entries:   TreeMap[str, str]   # entry_id → input text
    results:   TreeMap[str, str]   # entry_id → AI analysis (JSON string)
    statuses:  TreeMap[str, str]   # entry_id → "pending" | "evaluated" | "done"
    authors:   TreeMap[str, str]   # entry_id → wallet address of submitter
    next_id:   str                 # auto-increment counter (stored as string)

    def __init__(self):
        """Constructor — runs only once at deployment."""
        self.next_id = "0"

    # ══════════════════════════════════════════════════════════════════════
    #  WRITE METHODS — modify state, require gas, require wallet signature
    # ══════════════════════════════════════════════════════════════════════

    @gl.public.write
    def submit(self, text: str) -> typing.Any:
        """
        Store a new entry on-chain.

        Args:
            text: The input text (1–500 chars)

        Returns:
            entry_id (str): The ID for this entry — use it to evaluate later.

        Called from the API:
            POST /entries  { "text": "..." }
        """
        # Input validation — assertions revert the transaction on failure
        assert len(text) > 0,    "Text cannot be empty"
        assert len(text) <= 500, "Text cannot exceed 500 characters"

        entry_id = str(self.next_id)

        # Write to persistent storage
        self.entries[entry_id]  = text
        self.results[entry_id]  = ""         # empty until evaluated
        self.statuses[entry_id] = "pending"
        self.authors[entry_id]  = gl.message.sender_address.as_hex

        # Increment the counter
        self.next_id = str(int(self.next_id) + 1)

        # Return value is included in the transaction receipt
        # Your API can read it from receipt.result
        return entry_id

    @gl.public.write
    def evaluate(self, entry_id: str) -> typing.Any:
        """
        Run AI analysis on a previously submitted entry.
        This is a NON-DETERMINISTIC operation — each validator calls
        the LLM independently. gl.eq_principle.strict_eq coordinates consensus.

        Args:
            entry_id: The ID returned by submit()

        Returns:
            dict: The AI analysis result (stored on-chain)

        Called from the API:
            POST /entries/:id/evaluate
        """
        # State machine — enforce correct order
        assert entry_id in self.entries,             "Invalid entry ID"
        assert self.statuses[entry_id] == "pending", "Entry already evaluated"

        # ⚠️  CRITICAL: Read from storage BEFORE entering the nondet block.
        #     Storage reads inside the def get_result() function may fail.
        text = str(self.entries[entry_id])

        def get_result() -> str:
            """
            This function runs inside EACH validator node independently.
            Every validator calls the LLM with the same prompt.
            gl.eq_principle.strict_eq then compares results for equivalence.
            """
            task = f"""You are an expert analyst.
Analyze this text: "{text}"

Return ONLY this JSON (no markdown, no extra text):
{{
    "summary": "one sentence summary",
    "sentiment": "positive or negative or neutral or mixed",
    "key_points": ["point 1", "point 2"],
    "recommendation": "brief recommendation",
    "confidence_score": "0.85"
}}

IMPORTANT:
- confidence_score must be a QUOTED STRING like "0.85", never a bare number.
- All values must be strings or arrays of strings.
- Output ONLY the JSON object."""

            raw = (
                gl.nondet.exec_prompt(task)
                .replace("```json", "")
                .replace("```", "")
                .strip()
            )

            parsed = json.loads(raw)

            # ⚠️  Always cast confidence_score to str.
            #     If the LLM returns it as a float (0.85), GenLayer's
            #     calldata encoder will crash with:
            #     TypeError: not calldata encodable 0.85: float
            parsed["confidence_score"] = str(parsed.get("confidence_score", "0"))

            # Defensive: ensure all text fields are strings
            for key in ["summary", "sentiment", "recommendation"]:
                if key in parsed and not isinstance(parsed[key], str):
                    parsed[key] = str(parsed[key])

            # Ensure key_points is a list of strings
            kp = parsed.get("key_points", [])
            parsed["key_points"] = [str(p) for p in (kp if isinstance(kp, list) else [kp])]

            # Return as JSON string — strict_eq compares the serialized form
            return json.dumps(parsed, sort_keys=True)

        # Coordinate consensus among validators
        # Each runs get_result() independently; results are compared for semantic equivalence
        consensus_result = gl.eq_principle.strict_eq(get_result)
        result_dict      = json.loads(consensus_result)

        # Persist the agreed result on-chain
        self.results[entry_id]  = consensus_result
        self.statuses[entry_id] = "evaluated"

        return result_dict

    @gl.public.write
    def mark_done(self, entry_id: str, note: str) -> typing.Any:
        """
        Mark an evaluated entry as done with a final note.
        Must be called after evaluate().

        Args:
            entry_id: The entry ID
            note:     Final note or verdict to record

        Returns:
            dict: { "id": ..., "status": "done" }
        """
        assert entry_id in self.entries,               "Invalid entry ID"
        assert self.statuses[entry_id] == "evaluated", "Must be evaluated first"
        assert len(note) > 0,                          "Note cannot be empty"

        # Store the note as part of the result
        current = json.loads(self.results[entry_id] or "{}")
        current["final_note"] = note
        self.results[entry_id]  = json.dumps(current, sort_keys=True)
        self.statuses[entry_id] = "done"

        return {"id": entry_id, "status": "done"}

    # ══════════════════════════════════════════════════════════════════════
    #  VIEW METHODS — read-only, free, no wallet needed
    #  Return typing.Any to avoid "Value must be an instance of str" error
    #  from genlayer-js strict type checking.
    # ══════════════════════════════════════════════════════════════════════

    @gl.public.view
    def get_entry(self, entry_id: str) -> typing.Any:
        """Get full data for one entry."""
        assert entry_id in self.entries, "Invalid entry ID"
        return {
            "id":      str(entry_id),
            "text":    str(self.entries[entry_id]),
            "result":  str(self.results[entry_id]),
            "status":  str(self.statuses[entry_id]),
            "author":  str(self.authors[entry_id]),
        }

    @gl.public.view
    def get_all(self) -> typing.Any:
        """Get all entries as {id: text}."""
        return {str(k): str(v) for k, v in self.entries.items()}

    @gl.public.view
    def get_count(self) -> typing.Any:
        """Get total number of entries."""
        return str(self.next_id)

    @gl.public.view
    def get_status(self, entry_id: str) -> typing.Any:
        """Get just the status of one entry."""
        assert entry_id in self.entries, "Invalid entry ID"
        return str(self.statuses[entry_id])
