from __future__ import annotations

import base64
import binascii
import re
import zlib
from dataclasses import dataclass
from xml.etree import ElementTree

from app.schemas.poe import PoeEquipmentItemBase


MAX_XML_BYTES = 3_000_000
EQUIPMENT_SLOT_ORDER = (
    "Weapon 1",
    "Weapon 2",
    "Helmet",
    "Body Armour",
    "Gloves",
    "Boots",
    "Amulet",
    "Ring 1",
    "Ring 2",
    "Belt",
    "Flask 1",
    "Flask 2",
    "Flask 3",
    "Flask 4",
    "Flask 5",
    "Charm 1",
    "Charm 2",
    "Charm 3",
)


class PoeBuildParseError(ValueError):
    pass


@dataclass(frozen=True)
class PoeBuildSnapshot:
    game_version: str
    character_class: str | None
    ascendancy: str | None
    level: int
    equipment: list[PoeEquipmentItemBase]


class PoeBuildService:
    """Decode the user-provided Path of Building snapshot without external requests."""

    def preview(self, code: str) -> PoeBuildSnapshot:
        xml = self._decode(code)
        root = self._parse_xml(xml)
        build = root.find(".//Build")
        if build is None:
            raise PoeBuildParseError("Kod PoB nie zawiera sekcji danych postaci.")

        level = self._parse_level(build.attrib.get("level"))
        equipment = self._parse_equipment(root)
        if not equipment:
            raise PoeBuildParseError("Kod PoB nie zawiera założonych przedmiotów.")

        root_name = root.tag.rsplit("}", 1)[-1].lower()
        game_version = "poe2" if root_name.endswith("2") else "poe1"
        return PoeBuildSnapshot(
            game_version=game_version,
            character_class=self._clean(build.attrib.get("className")),
            ascendancy=self._clean(build.attrib.get("ascendClassName")),
            level=level,
            equipment=equipment,
        )

    @staticmethod
    def _decode(code: str) -> str:
        compact = "".join(code.strip().split())
        if compact.startswith("<"):
            return code.strip()
        try:
            padding = "=" * (-len(compact) % 4)
            compressed = base64.b64decode(compact + padding, altchars=b"-_", validate=True)
        except (binascii.Error, ValueError) as exc:
            raise PoeBuildParseError("Kod PoB ma nieprawidłowy format Base64.") from exc

        inflater = zlib.decompressobj()
        try:
            decoded = inflater.decompress(compressed, MAX_XML_BYTES + 1)
            if inflater.unconsumed_tail or len(decoded) > MAX_XML_BYTES:
                raise PoeBuildParseError("Rozpakowany kod PoB jest zbyt duży.")
            decoded += inflater.flush(MAX_XML_BYTES + 1 - len(decoded))
        except zlib.error as exc:
            raise PoeBuildParseError("Nie udało się rozpakować kodu PoB.") from exc
        if len(decoded) > MAX_XML_BYTES:
            raise PoeBuildParseError("Rozpakowany kod PoB jest zbyt duży.")
        try:
            return decoded.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise PoeBuildParseError("Kod PoB nie zawiera tekstu UTF-8.") from exc

    @staticmethod
    def _parse_xml(xml: str) -> ElementTree.Element:
        upper = xml.upper()
        if "<!DOCTYPE" in upper or "<!ENTITY" in upper:
            raise PoeBuildParseError("Kod PoB zawiera niedozwolone deklaracje XML.")
        try:
            root = ElementTree.fromstring(xml)
        except ElementTree.ParseError as exc:
            raise PoeBuildParseError("Kod PoB zawiera nieprawidłowy XML.") from exc
        root_name = root.tag.rsplit("}", 1)[-1]
        if root_name not in {"PathOfBuilding", "PathOfBuilding2"}:
            raise PoeBuildParseError("Nieobsługiwany format pliku PoB.")
        return root

    def _parse_equipment(self, root: ElementTree.Element) -> list[PoeEquipmentItemBase]:
        items_node = root.find(".//Items")
        if items_node is None:
            return []
        item_texts = {
            item.attrib.get("id", ""): (item.text or "").strip()
            for item in items_node.findall(".//Item")
            if item.attrib.get("id")
        }
        slot_container = self._active_item_set(items_node)
        slots = {slot.attrib.get("name", ""): slot for slot in slot_container.findall(".//Slot")}

        result: list[PoeEquipmentItemBase] = []
        for display_order, slot_name in enumerate(EQUIPMENT_SLOT_ORDER):
            slot = slots.get(slot_name)
            if slot is None:
                continue
            item_id = slot.attrib.get("itemId", "")
            item_text = item_texts.get(item_id, "")
            if not item_text:
                continue
            name, base_type, rarity = self._item_identity(item_text)
            result.append(
                PoeEquipmentItemBase(
                    slot=slot_name,
                    name=name,
                    base_type=base_type,
                    rarity=rarity,
                    item_text=item_text[:20_000],
                    display_order=display_order,
                )
            )
        return result

    @staticmethod
    def _active_item_set(items_node: ElementTree.Element) -> ElementTree.Element:
        active_id = items_node.attrib.get("activeItemSet")
        if active_id:
            for item_set in items_node.findall("./ItemSet"):
                if item_set.attrib.get("id") == active_id:
                    return item_set
        return items_node

    @staticmethod
    def _item_identity(item_text: str) -> tuple[str, str | None, str | None]:
        lines = [line.strip() for line in item_text.splitlines() if line.strip()]
        rarity = None
        if lines and lines[0].lower().startswith("rarity:"):
            rarity = lines.pop(0).split(":", 1)[1].strip().lower() or None
        identity = [line for line in lines if not re.fullmatch(r"-+", line)]
        if not identity:
            return "Nieznany przedmiot", None, rarity
        if rarity in {"rare", "unique", "relic"} and len(identity) >= 2:
            name = identity[1] if identity[0].casefold() == "new item" else identity[0]
            return name, identity[1], rarity
        return identity[0], identity[0], rarity

    @staticmethod
    def _parse_level(value: str | None) -> int:
        try:
            level = int(value or 1)
        except ValueError as exc:
            raise PoeBuildParseError("Poziom postaci w kodzie PoB jest nieprawidłowy.") from exc
        if not 1 <= level <= 100:
            raise PoeBuildParseError("Poziom postaci w kodzie PoB musi mieścić się od 1 do 100.")
        return level

    @staticmethod
    def _clean(value: str | None) -> str | None:
        cleaned = value.strip() if value else ""
        return cleaned or None
