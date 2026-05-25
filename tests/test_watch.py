import aria.pipeline as pipeline
from aria.config import Config, GmailConfig
from aria.pipeline import RunOptions, email_key, run
from aria.watch import load_state, save_state, watch
from aria.models import Provider

from .conftest import make_email


class FakeProvider:
    def __init__(self, emails):
        self.emails = emails
        self.ops = []

    def fetch(self, max_results=50, query=None, unread_only=False):
        return self.emails

    def apply_category_label(self, e, label):
        self.ops.append(("label", e.id))

    def flag(self, e):
        self.ops.append(("flag", e.id))

    def archive(self, e):
        self.ops.append(("archive", e.id))

    def move_to_trash(self, e):
        self.ops.append(("trash", e.id))

    def delete(self, e):
        self.ops.append(("delete", e.id))


def _cfg():
    return Config(providers=[Provider.GMAIL], gmail=GmailConfig())


def test_skip_ids_filters_already_seen(monkeypatch):
    e1 = make_email(eid="a", subject="hi there")
    e2 = make_email(eid="b", subject="hello again")
    monkeypatch.setattr(pipeline, "build_provider", lambda p, c: FakeProvider([e1, e2]))

    seen = {email_key(e1)}
    res = run(_cfg(), RunOptions(providers=[Provider.GMAIL], skip_ids=seen))
    ids = {c.email.id for c in res.classified}
    assert ids == {"b"}  # "a" was skipped


def test_state_roundtrip(tmp_path):
    path = str(tmp_path / "state.json")
    save_state(path, {"gmail:1", "gmail:2"})
    assert load_state(path) == {"gmail:1", "gmail:2"}


def test_state_cap(tmp_path):
    path = str(tmp_path / "state.json")
    save_state(path, {f"gmail:{i}" for i in range(10)}, cap=3)
    assert len(load_state(path)) == 3


def test_watch_once_records_state_and_never_purges(tmp_path, monkeypatch):
    e1 = make_email(eid="x", sender="scam@you-won.biz",
                    subject="Congratulations you have won a gift card",
                    body_text="claim your prize you are a winner")
    fake = FakeProvider([e1])
    monkeypatch.setattr(pipeline, "build_provider", lambda p, c: fake)

    path = str(tmp_path / "state.json")
    # purge requested, but watch must force it off — junk goes to trash, never delete.
    opts = RunOptions(providers=[Provider.GMAIL], dry_run=False, purge=True)
    watch(_cfg(), opts, interval=0, once=True, state_file=path)

    assert email_key(e1) in load_state(path)
    assert ("trash", "x") in fake.ops
    assert ("delete", "x") not in fake.ops
