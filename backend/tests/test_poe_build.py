import base64
import zlib

import pytest

from app.integrations.poe_build import PoeBuildParseError, PoeBuildService


POB_XML = """<PathOfBuilding>
  <Build level="96" className="Witch" ascendClassName="Elementalist" />
  <Items activeItemSet="1">
    <Item id="1">Rarity: UNIQUE
Crown of the Inward Eye
Prophet Crown
--------
+21 to maximum Energy Shield</Item>
    <Item id="2">Rarity: RARE
Victory Ward
Vaal Regalia
--------
+100 to maximum Life</Item>
    <ItemSet id="1">
      <Slot name="Helmet" itemId="1" />
      <Slot name="Body Armour" itemId="2" />
      <Slot name="Weapon 1 Swap" itemId="2" />
    </ItemSet>
  </Items>
</PathOfBuilding>"""


def encode_pob(xml: str = POB_XML) -> str:
    return base64.urlsafe_b64encode(zlib.compress(xml.encode())).decode().rstrip("=")


def test_pob_parser_reads_character_and_only_equipped_slots():
    preview = PoeBuildService().preview(encode_pob())

    assert preview.game_version == "poe1"
    assert preview.level == 96
    assert preview.character_class == "Witch"
    assert preview.ascendancy == "Elementalist"
    assert [item.slot for item in preview.equipment] == ["Helmet", "Body Armour"]
    assert preview.equipment[0].name == "Crown of the Inward Eye"
    assert preview.equipment[0].base_type == "Prophet Crown"
    assert preview.equipment[0].rarity == "unique"


def test_pob_parser_accepts_raw_poe2_xml_and_rejects_unsafe_xml():
    poe2_xml = POB_XML.replace("PathOfBuilding", "PathOfBuilding2")
    assert PoeBuildService().preview(poe2_xml).game_version == "poe2"

    with pytest.raises(PoeBuildParseError, match="niedozwolone deklaracje"):
        PoeBuildService().preview("<!DOCTYPE foo><PathOfBuilding></PathOfBuilding>")

    with pytest.raises(PoeBuildParseError, match="Base64"):
        PoeBuildService().preview("this-is-not-a-valid-pob-code!!!")


def test_pob_parser_replaces_crafted_new_item_placeholder_with_base_type():
    xml = POB_XML.replace("Victory Ward\nVaal Regalia", "New Item\nVaal Regalia")

    preview = PoeBuildService().preview(encode_pob(xml))

    body_armour = next(item for item in preview.equipment if item.slot == "Body Armour")
    assert body_armour.name == "Vaal Regalia"
    assert body_armour.base_type == "Vaal Regalia"
