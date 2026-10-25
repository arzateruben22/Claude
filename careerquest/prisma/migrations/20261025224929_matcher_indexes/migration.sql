-- CreateIndex
CREATE INDEX "ApplicationSourceLink_url_idx" ON "ApplicationSourceLink"("url");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_threadId_idx" ON "EmailMessage"("userId", "threadId");

-- CreateIndex
CREATE INDEX "JobLead_userId_normalizedUrl_idx" ON "JobLead"("userId", "normalizedUrl");

