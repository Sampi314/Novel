# Thiên Hoang Đại Lục 天荒大陸

Ứng dụng web tương tác khám phá thế giới tiên hiệp **Thiên Hoang Đại Lục** — nơi mười tộc tồn tại trên một đại lục cổ đại, với hệ thống linh khí, tu luyện, và lịch sử trải dài hàng trăm ngàn năm.

## Tính năng

- **Bản Đồ Tương Tác** — Fantasy Map Generator với địa hình, lãnh thổ, thành phố, tuyến thương mại
- **Kỷ Nguyên** — 7 thời đại từ Thái Sơ đến Hiện Đại
- **Thế Giới** — Sáng thế, hệ thống linh khí, phương pháp tu luyện
- **Chủng Tộc** — 10 tộc với nguồn gốc, quan hệ chính trị
- **Nhân Vật** — Hồ sơ nhân vật, hành trình, sơ đồ quan hệ, dòng thời gian
- **Địa Điểm** — Thành phố, thánh địa, bí cảnh
- **Sự Kiện** — Đại chiến, truyền thuyết theo dòng lịch sử
- **Cốt Truyện** — Các tuyến truyện chính
- **Linh Thú** — Sinh vật linh của đại lục
- **Văn Chương** — Thơ, nhạc, văn với AI sáng tác (Anthropic Claude)

### Công cụ sáng tác

- **Tạo Văn Chương** — Sáng tác thơ/nhạc/văn bằng AI với 4 tầng (Nguyên Văn → Hán Việt Âm → Trực Dịch → Phân Tích)
- **Tạo Nhân Vật** — Thiết kế nhân vật với AI, tự động tạo tiểu sử và thông số
- **Chế độ loạt bài** — Tạo nhiều tác phẩm cùng lúc theo chủ đề
- **Tải lên chân dung** — Hỗ trợ hình ảnh nhân vật

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19 + Vite |
| Bản đồ | Azgaar's Fantasy Map Generator |
| Dữ liệu | D3.js (CSV/JSON) |
| AI | Anthropic Claude API |
| Triển khai | GitHub Pages |
| Giao diện | Inline styles, CSS variables, Canvas animations |

## Cài đặt

```bash
# Clone repo
git clone https://github.com/<username>/Novel.git
cd Novel

# Cài dependencies
npm install
cd fmg && npm install && cd ..

# Chạy dev server
npm run dev
```

Ứng dụng chạy tại `http://localhost:5173`, FMG tại `http://localhost:5174`.

## Cấu trúc

```
src/
  App.jsx                 — Shell, tải dữ liệu, chuyển tab
  components/
    Sidebar.jsx           — Thanh điều hướng
    StarParticles.jsx     — Hiệu ứng sao nền
    LiteratureCreatorModal.jsx — Modal sáng tác văn chương
    CharacterCreatorModal.jsx  — Modal tạo nhân vật
    AudioPlayer.jsx       — Trình phát nhạc
  pages/
    HomePage.jsx          — Trang chủ
    ErasPage.jsx          — Kỷ nguyên
    LorePage.jsx          — Thế giới
    FactionsPage.jsx      — Chủng tộc
    CharactersPage.jsx    — Nhân vật
    LocationsPage.jsx     — Địa điểm
    EventsPage.jsx        — Sự kiện
    StoryArcsPage.jsx     — Cốt truyện
    BestiaryPage.jsx      — Linh thú
    LiteraturePage.jsx    — Văn chương
  utils/
    claudeApi.js          — Helper gọi Claude API
    devFileWriter.js      — Ghi file (dev mode)
    literatureStorage.js  — Lưu văn chương
    characterStorage.js   — Lưu nhân vật
public/data/
  world.json              — Dữ liệu thế giới
  *.csv                   — Nhân vật, địa điểm, sự kiện
  literature-index.json   — Index văn chương
fmg/                      — Fantasy Map Generator
```

## Triển khai

Tự động triển khai lên GitHub Pages khi push vào `main`:

```bash
git add .
git commit -m "feat: nội dung mới"
git push origin main
```

GitHub Actions sẽ build và deploy tự động.

## Sáng tác nội dung

1. Chạy `npm run dev` (chế độ phát triển)
2. Dùng các công cụ sáng tác trong ứng dụng
3. Nội dung tự động lưu vào `public/data/`
4. Commit và push để triển khai

## Giấy phép

Dự án cá nhân. Mọi nội dung sáng tạo thuộc về tác giả.
