/* Lumevina — stacked connect cards
   Vanilla port of emerald-ui's StackedArticleCards: the cards rest
   in a peeked stack; clicking (or Enter/Space) fans them out, and
   Show less restacks them. Links are inert while collapsed so the
   first tap expands instead of navigating. */

(function () {
  "use strict";

  var stack = document.querySelector(".stack-cards");
  if (!stack) return;

  var showLess = stack.querySelector(".stack-less");
  var links = stack.querySelectorAll(".stack-card a");

  var setState = function (active) {
    stack.classList.toggle("active", active);
    stack.setAttribute("aria-expanded", String(active));
    links.forEach(function (a) {
      a.tabIndex = active ? 0 : -1;
    });
  };

  stack.addEventListener("click", function () {
    if (!stack.classList.contains("active")) setState(true);
  });

  stack.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target === stack) {
      e.preventDefault();
      setState(!stack.classList.contains("active"));
    }
  });

  showLess.addEventListener("click", function (e) {
    e.stopPropagation();
    setState(false);
    stack.focus();
  });

  setState(false);
})();
