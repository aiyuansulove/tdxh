---
title: "联系我们"
date: 2024-01-15
menu:
    main:
        weight: 4
---

# 联系我们

有任何问题或合作意向，欢迎与我们联系。

## 联系方式

- **地址**：黑龙江省
- **电话**：请通过邮箱咨询
- **邮箱**：info@tiandixunhuang.com

## 留言

您可以通过以下表单联系我们：

<form id="contactForm" onsubmit="return handleContactForm(event)">
  <div class="form-group">
    <label for="name">姓名</label>
    <input type="text" id="name" name="name" required>
  </div>
  <div class="form-group">
    <label for="email">邮箱</label>
    <input type="email" id="email" name="email" required>
  </div>
  <div class="form-group">
    <label for="message">留言内容</label>
    <textarea id="message" name="message" required></textarea>
  </div>
  <button type="submit" class="btn" id="contactSubmitBtn">发送留言</button>
</form>
<script>
function handleContactForm(e) {
  e.preventDefault();
  var name = document.getElementById('name').value.trim();
  var email = document.getElementById('email').value.trim();
  var message = document.getElementById('message').value.trim();
  var btn = document.getElementById('contactSubmitBtn');
  var subject = encodeURIComponent('天地鲟鳇 网站留言：' + name);
  var body = encodeURIComponent('姓名：' + name + '\n邮箱：' + email + '\n\n留言：\n' + message);
  window.location.href = 'mailto:info@tiandixunhuang.com?subject=' + subject + '&body=' + body;
  btn.textContent = '✅ 已打开邮件客户端';
  setTimeout(function(){ btn.textContent = '发送留言'; }, 3000);
  return false;
}
</script>