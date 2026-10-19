/* Lumevina — Reach out
 *
 * The Contact form in place of the old journal. A question lands in
 * Evelyn's dashboard under Client questions, beside the ones the chat
 * hands her, with a short reply drafted for her to check and send.
 *
 * DEMO: saved in this browser (lumevina_questions), so it reaches the
 * dashboard only on the same device. The thank-you also offers the same
 * message as an email, which reaches her today from any device.
 * LIVE: the server's questions table (server/schema.sql), which emails
 * her a heads-up (server/README.md → Ask Lumevina).
 */
(function () {
  "use strict";

  var form = document.querySelector(".contact-form");
  if (!form) return;

  var KEY = "lumevina_questions";
  var EMAIL = "Lumevina.aesthetics@gmail.com";
  var REPLY_HOURS = 48;
  var status = form.querySelector(".form-status");
  var nameIn = form.querySelector("#ct-name");
  var emailIn = form.querySelector("#ct-email");
  var topicIn = form.querySelector("#ct-topic");
  var msgIn = form.querySelector("#ct-msg");

  /* a signed-in client doesn't retype who they are */
  var fillFromAccount = function () {
    var a = window.LumevinaAccount && window.LumevinaAccount.current();
    if (!a) return;
    if (!nameIn.value) nameIn.value = a.name || "";
    if (!emailIn.value) emailIn.value = a.email || "";
  };
  fillFromAccount();
  document.addEventListener("lumevina:account-changed", fillFromAccount);

  /* the dashboard sorts questions by kind: anything about a client's own
     skin is one Evelyn answers herself */
  var KIND = { booking: "request", treatment: "other", skin: "skin", order: "request", other: "other" };
  var TOPIC = { booking: "Booking", treatment: "A treatment", skin: "My skin", order: "An order", other: "Something else" };

  var read = function () {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  };

  var mailto = function (name, topic, text) {
    return "mailto:" + EMAIL +
      "?subject=" + encodeURIComponent("Question from " + name + " · " + topic) +
      "&body=" + encodeURIComponent(text + "\n\n" + name);
  };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.textContent = "";
    status.classList.remove("is-error");
    var name = nameIn.value.trim();
    var email = emailIn.value.trim();
    var text = msgIn.value.trim();
    var missing = !name ? nameIn : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? emailIn : !text ? msgIn : null;
    if (missing) {
      status.classList.add("is-error");
      status.textContent = missing === nameIn ? "Add your name so Evelyn knows who's asking."
        : missing === emailIn ? "Add an email like you@example.com so Evelyn can reply."
        : "Write your question, then send.";
      missing.focus();
      return;
    }
    var topic = topicIn.value;
    var due = new Date(Date.now() + REPLY_HOURS * 36e5);
    var q = {
      id: "q" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      at: new Date().toISOString(), name: name, email: email, member: false, plan: "",
      text: (TOPIC[topic] ? TOPIC[topic] + ": " : "") + text, kind: KIND[topic] || "other",
      status: "waiting", dueAt: due.toISOString(), source: "contact",
      draft: "Hi " + name.split(" ")[0] + ", thank you for reaching out! — Evelyn"
    };
    var all = read();
    all.push(q);
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (err) { /* private mode */ }
    document.dispatchEvent(new CustomEvent("lumevina:question-sent", { detail: q }));

    status.textContent = "";
    var done = document.createElement("span");
    done.textContent = "Sent. Evelyn will reply to " + email + " by " +
      due.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) + ". ";
    var alt = document.createElement("a");
    alt.className = "inline-link";
    alt.href = mailto(name, TOPIC[topic] || "Question", text);
    alt.textContent = "Email it too";
    status.appendChild(done);
    status.appendChild(alt);
    msgIn.value = "";
  });
})();
