# 이마트 POS 대시보드 · 맥널티커피

점포·상품별 일/주/월/누적 판매 분석 대시보드입니다. 시트는 **판매분석 · 미매출현황 · 행사현황** 세 개입니다.
화면(로직)과 데이터가 분리되어 있어서, **매달 `data/` 폴더만 갱신**하면 됩니다.

## 폴더 구조

```
index.html              화면 뼈대 + 데이터 로더 (수정할 일 거의 없음)
assets/app.js           대시보드 엔진 — 계산·차트·표 (데이터가 바뀌어도 수정 불필요)
assets/style.css        스타일
data/manifest.js        불러올 월 목록 + 갱신일  ← 변환기가 자동 관리
data/master.js          점포·상품 마스터 + 공휴일 ← 새 점포/상품은 변환기가 자동 추가
data/2026-08.js         월별 일자 데이터 (한 달 = 한 파일)
data/2026-09.js
data/raw/inbox/         여기에 이마트 원본을 올리면 GitHub Actions가 자동 변환
tools/build_month.py    원본(xlsx/csv) → data/YYYY-MM.js 변환기
```

데이터 파일은 `.json` 이 아니라 `.js`(`EMART_MONTH({...})` 형태)입니다.
이렇게 해야 GitHub Pages에서도, PC에서 `index.html` 을 더블클릭해서 열어도 똑같이 동작합니다
(`.json` 은 브라우저 보안 정책 때문에 PC에서 직접 열면 읽히지 않습니다).

## 매달(또는 매주) 데이터 갱신하기

### 방법 A. GitHub에 원본만 올리기 (권장)
1. 이마트 **기간별매출(상품별) 일별상세** 원본을 엑셀(.xlsx) 또는 CSV로 받습니다. `.xls` 는 `.xlsx` 로 다시 저장해 주세요.
2. GitHub 저장소의 `data/raw/inbox/` 폴더에 업로드합니다. (Add file → Upload files → Commit)
3. 1~2분 뒤 Actions가 `data/YYYY-MM.js` 를 만들고 원본은 `data/raw/done/` 으로 옮깁니다.
   결과 요약은 저장소 **Actions** 탭에서 볼 수 있습니다.

### 방법 B. PC에서 변환 후 올리기
```bash
pip install openpyxl
python tools/build_month.py 원본.xlsx
```
`data/` 폴더에서 바뀐 파일(`YYYY-MM.js`, `manifest.js`, `master.js`)을 GitHub에 올립니다.

### 변환 규칙
- 원본 한 행 = 하루·점포·상품 (세로형). 필요한 열: **일자, 점포코드, 상품코드, 판매수량, 판매금액**
  (점포명·상품명·중분류·소분류·브랜드는 있으면 사용). 위쪽 제목 줄은 자동으로 건너뜁니다.
- 원본에 있는 **날짜만 교체**하고 나머지 날짜는 그대로 둡니다 → 월 중간에 1~15일, 다음에 1~31일을 올려도 됩니다.
  그 달을 통째로 다시 만들려면 `--replace-month` 옵션을 씁니다.
- 진행 중인 달(예: 10/1~10/15)은 대시보드에서 **전월 동기간(9/1~9/15)** 과 비교됩니다.
- 새 상품의 분류가 원본에 없으면 `미분류` 로 들어갑니다 → `data/master.js` 에서 중분류·소분류·브랜드를 채워 주세요.
- 공휴일은 `data/master.js` 의 `holidays` 에 `"2027-01-01":"신정"` 형식으로 추가합니다.
  의무휴업일(둘째·넷째 일요일)은 자동 표시됩니다.

## 로컬에서 미리 보기
`index.html` 을 더블클릭하면 됩니다.

## GitHub Pages 공개
저장소 Settings → Pages → Source: *Deploy from a branch*, Branch: `main` / `(root)`.

> ⚠️ 데이터에 **이마트 매입원가 기준 금액과 점포별 실적**이 들어 있습니다.
> 공개(Public) 저장소 + GitHub Pages면 링크를 아는 누구나 볼 수 있습니다.
> 외부 공개가 곤란하면 **비공개(Private) 저장소**를 쓰세요. 비공개 저장소에서 Pages를 쓰려면 GitHub 유료 플랜(Pro/Team)이 필요합니다.
