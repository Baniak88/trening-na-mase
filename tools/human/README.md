# Ciało do animacji 3D

`build_body.py` buduje `js/data/body.bin` (ok. 430 KB): realistyczną sylwetkę z MakeHuman (siatka bazowa, cele kształtu, szkielet i wagi; licencja CC0 1.0, https://github.com/makehumancommunity/makehuman, katalog `makehuman/data`).

```
git clone --depth 1 --filter=blob:none --sparse https://github.com/makehumancommunity/makehuman mh
cd mh && git sparse-checkout set --no-cone 'makehuman/data/3dobjs/*' 'makehuman/data/rigs/*' 'makehuman/data/targets/macrodetails/*male-young*' 'makehuman/data/targets/macrodetails/proportions/male-young-*' 'makehuman/data/targets/torso/*' 'makehuman/data/targets/stomach/*' && cd ..
python3 tools/human/build_body.py mh/makehuman/data js/data/body.bin
```

Co robi: młody, wysportowany mężczyzna (mięśnie 0,8) → stawy z grup pomocniczych → kości MakeHuman połączone w stawy figury (miednica, kręgosłup, klatka, szyja, głowa, bark, łokieć, skręt przedramienia, dłoń, palce, biodro, kolano, kostka) → mięśnie malowane na wierzchołkach (dwa najsilniejsze na wierzchołek), spodenki, buty i włosy jako warstwa „cloth”.

Format (little endian): `TNMB`, u32 długość JSON, JSON (stawy, kości z obrotem C i pozycją wiązania, długości, punkt chwytu), pozycje u16×3 (kwantyzowane, `lo` + `q`), indeksy trójkątów u16, indeksy kości u8×4, wagi u8×4, mięśnie u8×4 (id, waga, id, waga), klasa u8 (1 spodenki, 2 buty, 3 oczy, 4 włosy), udział warstwy u8.
