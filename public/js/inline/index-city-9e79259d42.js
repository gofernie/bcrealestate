
  (() => {
    const button = document.querySelector("[data-homepage-contact]");
    const form = document.getElementById("homepage-agent-contact-form");
    const cancel = document.querySelector("[data-homepage-contact-cancel]");
    const status = form?.querySelector('[role="status"]');

    if (!(button instanceof HTMLButtonElement) ||
        !(form instanceof HTMLFormElement)) return;

    button.addEventListener("click", () => {
      const willOpen = form.hidden;
      form.hidden = !willOpen;
      button.setAttribute("aria-expanded", String(willOpen));

      if (willOpen) {
        form.querySelector("input[name='name']")?.focus();
        form.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    cancel?.addEventListener("click", () => {
      form.reset();
      form.hidden = true;
      button.setAttribute("aria-expanded", "false");
      if (status) status.textContent = "";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const submit = form.querySelector('button[type="submit"]');
      const values = new FormData(form);
      const name = String(values.get("name") || "").trim();
      const email = String(values.get("email") || "").trim();
      const phone = String(values.get("phone") || "").trim();
      const question = String(values.get("question") || "").trim();

      if (!name || !email || !question) return;

      if (submit instanceof HTMLButtonElement) {
        submit.disabled = true;
        submit.textContent = "Sending...";
      }

      if (status) status.textContent = "";

      try {
        const response = await fetch("/api/intent-lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email,
            phone,
            question,
            site_id: String(
              form.closest(".homepage-agent-nudge")?.dataset.siteId || ""
            ).trim(),
            source: "Homepage contact",
            message: [
              "Homepage contact request.",
              "Question: " + question,
            ].join("\n"),
          }),
        });

        if (!response.ok) throw new Error("Could not send your message.");

        form.reset();
        if (status) {
          status.textContent = "Thanks   your message has been sent.";
        }
      } catch (error) {
        if (status) {
          status.textContent = error?.message || "Could not send your message. Please try again.";
        }
      } finally {
        if (submit instanceof HTMLButtonElement) {
          submit.disabled = false;
          submit.textContent = "Send message";
        }
      }
    });
  })();
