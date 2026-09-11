# K4 — Ngày 1: Bài Tập & Phản Ánh
## Khám Phá LLM API | Phiếu Thực Hành

**Thời lượng:** 4 tiếng
**Cách làm:** Trả lời từng câu ngay sau khi hoàn thành block tương ứng —
đừng để dồn hết về cuối buổi. Thay dòng `*Câu trả lời của bạn*` bằng câu
trả lời thật (chấm tự động sẽ đếm số câu đã trả lời).

---

## Block 1 — API Cơ Bản (trả lời sau Checkpoint 1)

### Câu 1.1 — Độ nhạy của temperature
Gọi `call_openai` với temperature 0.0, 0.5, 1.0 và 1.5 dùng prompt
**"Hãy kể cho tôi một sự thật thú vị về Việt Nam."**

**Bạn nhận thấy quy luật gì qua bốn phản hồi?** (2–3 câu)
> Khi tăng temperature từ 0.0 lên 1.5, câu trả lời chuyển từ tính xác định, súc tích và nhất quán (0.0 luôn chọn token có xác suất cao nhất như xuất khẩu cà phê/hạt điều) sang phong phú, đa dạng hơn về góc nhìn văn hóa (0.5 – 1.0). Ở mức 1.5, văn phong trở nên bay bổng, bất ngờ hơn nhưng bắt đầu xuất hiện câu từ lan man hoặc cấu trúc ngữ pháp kém tự nhiên do model lấy mẫu cả những token có xác suất thấp.

### Câu 1.2 — Chọn temperature cho sản phẩm
**Bạn sẽ đặt temperature bao nhiêu cho chatbot hỗ trợ khách hàng, và tại sao?**
> Cho chatbot hỗ trợ khách hàng, tôi sẽ đặt temperature khoảng 0.2 đến 0.3 (hoặc 0.0 nếu là bot tra cứu chính sách/FAQ nghiêm ngặt). Lý do là chatbot CSKH ưu tiên cao nhất tính chính xác, nhất quán và tin cậy của thông tin sản phẩm/chính sách, đồng thời giảm thiểu tối đa hiện tượng ảo giác (hallucination). Mức nhiệt độ thấp giữ câu trả lời chuẩn xác theo tài liệu nhưng vẫn giữ đủ độ linh hoạt tự nhiên trong giao tiếp.

### Câu 1.3 — Đánh đổi chi phí
Kịch bản: 10.000 người dùng hoạt động mỗi ngày, mỗi người gọi API 3 lần,
mỗi lần trung bình ~350 token đầu ra.

**Ước tính GPT-4o đắt hơn GPT-4o-mini bao nhiêu lần cho workload này? Nêu một
trường hợp GPT-4o xứng đáng với chi phí và một trường hợp nên dùng mini:**
> Theo bảng giá output (GPT-4o: $0.010/1K token; GPT-4o-mini: $0.0006/1K token), GPT-4o đắt hơn GPT-4o-mini khoảng 16.67 lần (0.010 / 0.0006 ≈ 16.67). Tổng token output mỗi ngày là 10.000 × 3 × 350 = 10.500.000 token (~10.500K token), chi phí GPT-4o là 105 USD/ngày trong khi mini chỉ tốn 6.30 USD/ngày (tiết kiệm gần 99 USD mỗi ngày). GPT-4o xứng đáng với chi phí khi cần suy luận logic phức tạp, tư vấn pháp lý, phân tích mã nguồn hoặc tổng hợp tài liệu học thuật nhiều bước; trong khi mini rất phù hợp cho các tác vụ phân loại ý định (intent classification), tóm tắt tin nhắn ngắn hoặc trả lời các câu hỏi FAQ thường gặp của người dùng.

---

## Block 2 — System Prompt & Token (trả lời sau Checkpoint 2)

### Câu 2.1 — Sức mạnh của persona
Gọi `chat_with_system_prompt` hai lần với cùng câu hỏi
**"Giải thích blockchain là gì?"** nhưng hai system prompt khác nhau:
- "Bạn là giáo viên tiểu học, giải thích thật đơn giản cho trẻ 8 tuổi."
- "Bạn là chuyên gia tài chính, trả lời chuyên sâu bằng thuật ngữ kỹ thuật."

**Hai phản hồi khác nhau như thế nào (độ dài, từ vựng, ví dụ)? System prompt
ảnh hưởng đến hành vi model ra sao?** (3–4 câu)
> Với persona giáo viên tiểu học, phản hồi ngắn gọn, dùng từ ngữ mộc mạc và ví dụ trực quan gần gũi như "cuốn sổ tay ghi chép chung trong lớp mà ai cũng có bản sao để không ai gian lận được". Ngược lại, với persona chuyên gia tài chính, phản hồi sử dụng hệ thuật ngữ chuyên ngành chuyên sâu như "sổ cái phân tán (distributed ledger)", "cơ chế đồng thuận (consensus mechanism)", "tính bất biến mã hóa (cryptographic immutability)" và phân tích cấu trúc khối. System prompt đóng vai trò như "bộ lọc ngữ cảnh ban đầu" (steering instruction), định hình toàn bộ phong cách ngôn ngữ, độ sâu kiến thức và đối tượng mục tiêu mà mô hình hướng đến trước khi xử lý câu hỏi của người dùng.

### Câu 2.2 — tiktoken vs đếm từ
Chọn một đoạn văn tiếng Việt ~100 từ. So sánh số token theo `count_tokens`
(tiktoken) với ước lượng `số từ / 0.75` mà Part 1 đã dùng.

**Hai con số chênh nhau bao nhiêu phần trăm? Vì sao tiếng Việt thường tốn
nhiều token hơn tiếng Anh cùng độ dài?**
> Với một đoạn văn tiếng Việt 100 từ, công thức ước lượng thô ở Part 1 cho kết quả 100 / 0.75 ≈ 133 token, nhưng khi đếm bằng `count_tokens` (bộ mã hóa o200k_base của GPT-4o), số token thực tế thường rơi vào khoảng 160 – 190 token, tức chênh lệch khoảng 20% – 40% so với ước tính tiếng Anh. Tiếng Việt tốn nhiều token hơn vì các mô hình BPE tokenizer (như tiktoken) được huấn luyện chủ yếu trên kho ngữ liệu tiếng Anh; tiếng Việt có dấu thanh điệu, các nguyên âm có dấu (như ơ, ư, ê, ă, đ) và từ ghép thường bị tách nhỏ thành nhiều subword hoặc chuỗi byte UTF-8 rời rạc thay vì gom nguyên từ như tiếng Anh.

---

## Block 3 — Streaming & Độ Bền (trả lời sau Checkpoint 3)

### Câu 3.1 — Trải nghiệm người dùng với streaming
**Streaming quan trọng nhất trong trường hợp nào, và khi nào thì
non-streaming lại phù hợp hơn?** (1 đoạn văn)
> Streaming quan trọng nhất trong các ứng dụng tương tác trực tiếp với người dùng (như chatbot hội thoại, công cụ viết văn, trợ lý lập trình), nơi giảm thiểu Time to First Token (TTFT) xuống dưới 1 giây giúp giao diện có phản hồi tức thì, người dùng có thể đọc ngay câu chữ đang sinh ra thay vì phải chờ đợi toàn bộ văn bản 5–10 giây. Ngược lại, non-streaming phù hợp hơn trong các pipeline xử lý ngầm (batch processing, ETL dữ liệu, phân loại sentiment, trích xuất dữ liệu có cấu trúc dạng JSON), các API backend cần kiểm tra tính hợp lệ của toàn bộ output hoặc chạy kiểm duyệt nội dung trước khi chuyển giao tiếp cho dịch vụ khác.

### Câu 3.2 — Vì sao backoff theo cấp số nhân?
**So với delay cố định (ví dụ luôn chờ 1 giây), exponential backoff có lợi
thế gì khi API bị quá tải? Điều gì xảy ra nếu hàng nghìn client cùng retry
với delay cố định giống nhau?**
> Exponential backoff giúp giãn cách thời gian giữa các lần thử lại theo cấp số nhân (ví dụ: 0.1s, 0.2s, 0.4s, 0.8s), tạo ra khoảng thời gian hồi phục đủ lớn để server giải tỏa hàng đợi và tài nguyên đang quá tải. Nếu hàng nghìn client cùng retry với một khoảng delay cố định (ví dụ đúng 1 giây sau), tất cả các request sẽ ồ ạt đánh đồng thời vào server ở giây tiếp theo, gây ra hiện tượng "thundering herd problem" (sóng xung kích dồn dập) khiến server bị nghẽn liên tục và sập hoàn toàn (cascading failure).

---

## Block 4 — Mini-Project (trả lời sau Checkpoint 4)

### Câu 4.1 — Thiết kế persona
**Bạn chọn persona gì cho trợ lý của mình? Viết lại system prompt đó và giải
thích 1–2 lựa chọn từ ngữ quan trọng trong prompt (ví dụ: vì sao yêu cầu
"trả lời ngắn gọn", vì sao chỉ định ngôn ngữ...):**
> Tôi chọn persona: "Bạn là trợ giảng thân thiện của khóa học AI thực chiến, giải thích khái niệm rõ ràng, ưu tiên ví dụ thực tế và trả lời súc tích bằng tiếng Việt." Lựa chọn cụm từ "trả lời súc tích" nhằm kiểm soát chi phí token đầu ra và giữ nhịp hội thoại dòng lệnh terminal không bị tràn màn hình; việc chỉ định rõ ràng "bằng tiếng Việt" đảm bảo trợ lý luôn phản hồi bằng ngôn ngữ người dùng mong muốn, hạn chế việc model tự động chuyển sang tiếng Anh khi gặp các từ khóa kỹ thuật.

### Câu 4.2 — Hạn chế & cải thiện
**Trợ lý của bạn hiện có hạn chế lớn nhất là gì (ví dụ: history chỉ 3 lượt,
không có bộ nhớ dài hạn, không kiểm duyệt nội dung...)? Đề xuất một cải
thiện cụ thể và mô tả ngắn cách triển khai:**
> Hạn chế lớn nhất của trợ lý hiện tại là cửa sổ ngữ cảnh ngắn (sliding window chỉ giữ 3 lượt gần nhất = 6 messages), dẫn đến việc trợ lý sẽ quên hoàn toàn thông tin quan trọng hoặc yêu cầu ban đầu mà người dùng đã thiết lập từ các lượt trước đó. Cải thiện cụ thể là triển khai cơ chế "Tóm tắt ngữ cảnh tích lũy" (Summarization Buffer Memory): khi history đạt ngưỡng cần cắt bỏ, thay vì xóa hẳn các lượt cũ, ta dùng một model nhỏ (như gpt-4o-mini) tóm tắt ngắn gọn các sự kiện/thông tin cốt lõi đã trao đổi thành 2–3 câu cô đọng và đưa bản tóm tắt đó vào ngay sau system prompt, giúp trợ lý duy trì trí nhớ dài hạn mà không làm bùng nổ số lượng token.

---

## Danh Sách Kiểm Tra Nộp Bài

- [x] `python grade.py` — xem điểm tự động, mục tiêu ≥ 75/100
- [x] Cả 4 checkpoint pytest đều pass
- [x] Tất cả 9 câu trong file này đã được trả lời
- [x] Đã copy bài làm vào folder `solution/`, push lên fork và dán link trên trang bài Lab ở VLearn trước 23:59 ngày 11/09/2026
