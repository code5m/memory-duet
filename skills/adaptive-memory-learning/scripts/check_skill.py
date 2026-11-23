#!/usr/bin/env python3
"""Skill 包含物、方法 ID 与示例路由的一致性检查。"""
from collections import Counter
from pathlib import Path
import json
import re
import sys

# 发布包自检本身会导入脚本；关闭字节码落盘，避免“检查动作”制造出
# 检查器随后要拒绝的 __pycache__ / *.pyc。
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from memory_router import choose_plan  # noqa: E402
from validate_lesson import validate_lesson  # noqa: E402
from review_planner import plan_review  # noqa: E402


def main():
    catalog = (ROOT / "references" / "method-catalog.md").read_text(encoding="utf-8")
    ids = re.findall(r"^\| ([VSALBCUR]\d{2}) \|", catalog, re.MULTILINE)
    expected = {"V": 6, "S": 6, "A": 5, "L": 5, "B": 5, "C": 6, "U": 5, "R": 4}
    actual = dict(Counter(x[0] for x in ids))
    assert actual == expected, f"方法数量错误：{actual}"
    assert len(ids) == len(set(ids)) == 42, "42个方法不得有重复"
    assert set(ids) == {f"{prefix}{i:02}" for prefix, count in expected.items() for i in range(1, count+1)}, "方法编号缺失或多出"

    skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
    assert skill.startswith("---\nname: adaptive-memory-learning\ndescription: "), "入口 frontmatter 未按规范定义 name 和 description"
    assert "自适应形象记忆教练 v5.0" in skill, "SKILL 版本未更新"
    assert len(skill.split("---", 2)) >= 3, "YAML frontmatter 未闭合"
    metadata = (ROOT / "agents" / "openai.yaml").read_text(encoding="utf-8")
    assert "interface:" in metadata and "display_name:" in metadata, "缺少 UI 元数据"
    for relative in re.findall(r"\]\((references/[^)]+)\)", skill):
        assert (ROOT / relative).is_file(), f"SKILL 引用不存在：{relative}"

    for req in ("README.md", "references/audit-v2.md", "references/audit-v3.md", "references/audit-v4.md", "references/audit-v5.md", "references/quality-rubric.md", "references/test-cases.md", "scripts/memory_router.py", "scripts/validate_lesson.py", "scripts/test_router.py", "scripts/test_v3_router.py", "scripts/test_lesson_validator.py", "scripts/test_v4_integrity.py", "scripts/test_v5_quality.py", "scripts/test_review_planner.py", "scripts/review_planner.py", "examples/review_sample.json"):
        assert (ROOT / req).is_file(), f"缺少必要文件：{req}"
    assert not list(ROOT.rglob("__pycache__")), "发布包不能包含Python缓存目录"
    assert not list(ROOT.rglob("*.pyc")), "发布包不能包含Python字节码文件"
    for path in ROOT.rglob("*"):
        if path.is_file() and path.suffix in {".md", ".yaml"}:
            txt = path.read_text(encoding="utf-8")
            assert "[TODO" not in txt and "{{PLACEHOLDER}}" not in txt, f"遗留占位符：{path}"

    examples = [p for p in (ROOT / "examples").glob("*.json") if not p.name.startswith(("lesson_", "review_"))]
    assert len(examples) >= 5, "缺少路由边界示例"
    for ex in examples:
        params = json.loads(ex.read_text(encoding="utf-8"))
        plan = choose_plan(**params)
        assert plan["engine_version"] == "5.0.0", f"{ex.name}: 路由器版本未更新"
        assert plan["primary_id"] in ids, f"{ex.name}: 无效主法"
        assert plan["support_id"] is None or plan["support_id"] in ids, f"{ex.name}: 无效辅法"
        assert sum(plan["mini_lesson_seconds"]) == params.get("lesson_minutes", 5)*60
        assert plan["batch_count"] >= 1
        assert plan["primary_id"] != plan["support_id"]
    lesson_examples = sorted((ROOT / "examples").glob("lesson_*.json"))
    assert len(lesson_examples) >= 4, "缺少完整教案验证样例"
    for ex in lesson_examples:
        plan = json.loads(ex.read_text(encoding="utf-8"))
        result = validate_lesson(plan)
        assert result["ok"], f"{ex.name}: 教案验证失败: {result['errors']}"
        assert result["checked"]["schema_version"] == "5.0.0", "教案结构版本未更新"
    for path in ROOT.rglob("*.md"):
        # Markdown link relative to current file; external URLs and anchors do not belong to local file tree.
        txt = path.read_text(encoding="utf-8")
        for dest in re.findall(r"\]\(([^)]+)\)", txt):
            if dest.startswith(("https://", "http://", "#", "mailto:")):
                continue
            candidate = (path.parent / dest.split("#")[0]).resolve()
            assert candidate.is_file(), f"{path.name}: 链接失效 {dest}"
    assert choose_plan("ordered", item_count=6)["primary_id"] != "B01", "6项超五指容量"
    assert choose_plan("ordered", item_count=20, has_palace=True, loci_count=10)["primary_id"] != "L01", "宫殿容量不足"
    assert choose_plan("language", language="other")["primary_id"] != "S04", "未知外语不得硬套谐音"
    cases = (ROOT / "references" / "test-cases.md").read_text(encoding="utf-8")
    case_ids = re.findall(r"^\| (T\d{2}) \|", cases, re.MULTILINE)
    assert len(case_ids) == len(set(case_ids)) >= 80, "人工验收用例不足或重复"
    assert set(case_ids) == {f"T{i:02d}" for i in range(1, 81)}, "验收用例编号不连续"
    reviewed = plan_review(json.loads((ROOT / "examples" / "review_sample.json").read_text(encoding="utf-8")))
    assert len(reviewed["items"]) == 4 and reviewed["status"].find("不保存") >= 0, "复习建议示例无效"
    print(f"PASS: {len(ids)}个方法/8组、{len(examples)}个路由样例、{len(lesson_examples)}个完整教案、{len(case_ids)}个人工验收场景；结构、引用、容量、方法编号校验通过")


if __name__ == "__main__":
    main()
