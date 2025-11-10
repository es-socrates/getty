<template>
  <section class="announcement-admin" role="form">
    <nav class="ann-tabs" aria-label="Announcement tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="ann-tab"
        :class="{ active: activeTab === tab.id }"
        role="tab"
        :aria-selected="activeTab === tab.id ? 'true' : 'false'"
        @click="activeTab = tab.id">
        {{ tab.label }}
      </button>
    </nav>

    <div v-show="activeTab === 'settings'" class="ann-tab-panel" role="tabpanel">
      <div class="ann-card">
        <div class="ann-card-header">
          <h3 class="ann-card-title">{{ t('announcementSettings') }}</h3>
        </div>
        <div class="ann-grid">
          <div class="ann-form-group">
            <label class="ann-form-label">{{
              t('announcementCooldownLabel') || t('announcementCooldownSeconds')
            }}</label>
            <input class="ann-input" type="number" v-model.number="cooldownMinutes" min="1" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementBgType') }}</label>
            <select class="ann-select" v-model="settings.bannerBgType">
              <option value="solid">{{ t('announcementBgSolid') }}</option>
              <option value="gradient">{{ t('announcementBgGradient') }}</option>
            </select>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementAnimationMode') }}</label>
            <select class="ann-select" v-model="settings.animationMode">
              <option value="fade">{{ t('announcementAnimationFade') }}</option>
              <option value="slide-up">{{ t('announcementAnimationSlideUp') }}</option>
              <option value="slide-left">{{ t('announcementAnimationSlideLeft') }}</option>
              <option value="scale">{{ t('announcementAnimationScale') }}</option>
              <option value="random">{{ t('announcementAnimationRandom') }}</option>
            </select>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementDefaultDuration') }}</label>
            <input
              class="ann-input"
              type="number"
              min="1"
              max="60"
              v-model.number="settings.defaultDurationSeconds" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementTextColor') }}</label>
            <input class="ann-input" type="color" v-model="settings.textColor" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementBgColor') }}</label>
            <input class="ann-input" type="color" v-model="settings.bgColor" />
          </div>
          <div class="ann-form-group" v-if="settings.bannerBgType === 'gradient'">
            <label class="ann-form-label">{{ t('announcementGradFrom') }}</label>
            <input class="ann-input" type="color" v-model="settings.gradientFrom" />
          </div>
          <div class="ann-form-group" v-if="settings.bannerBgType === 'gradient'">
            <label class="ann-form-label">{{ t('announcementGradTo') }}</label>
            <input class="ann-input" type="color" v-model="settings.gradientTo" />
          </div>
          <div class="ann-form-group">
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="switch"
                :aria-pressed="String(settings.applyAllDurations)"
                :aria-label="t('announcementApplyAll')"
                @click="settings.applyAllDurations = !settings.applyAllDurations">
                <span class="knob"></span>
              </button>
              <span class="ann-enabled-label">{{ t('announcementApplyAll') }}</span>
            </div>
          </div>
          <div class="ann-form-group">
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="switch"
                :aria-pressed="String(settings.staticMode)"
                :aria-label="t('announcementStaticMode')"
                @click="settings.staticMode = !settings.staticMode">
                <span class="knob"></span>
              </button>
              <span class="ann-enabled-label">{{ t('announcementStaticMode') }}</span>
            </div>
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button class="btn" type="button" @click="saveSettings" :disabled="savingSettings">
            {{ savingSettings ? t('commonUpdating') : t('saveSettings') }}
          </button>
        </div>
      </div>

      <div class="ann-card">
        <div class="ann-card-header">
          <h3 class="ann-card-title">{{ t('announcementAddMessage') }}</h3>
        </div>
        <form @submit.prevent="handleAddMessage">
          <div class="ann-section">
            <button
              class="ann-collapse"
              type="button"
              @click="sectionOpen.content = !sectionOpen.content">
              <span class="caret" :class="{ open: sectionOpen.content }"></span>
              {{ t('announcementSectionContent') || 'Contenido' }}
            </button>
            <div v-show="sectionOpen.content" class="ann-section-body">
              <div class="ann-grid">
                <div class="ann-form-group ann-grid-full">
                  <label class="ann-form-label">{{ t('announcementText') }}</label>
                  <textarea
                    class="ann-textarea ann-textarea--compact"
                    :class="{ 'input-error': errors.text }"
                    v-model="newMsg.text"
                    maxlength="90" />
                  <div
                    class="ann-char-count"
                    :class="{
                      warning: newMsg.text.length > 72 && newMsg.text.length <= 90,
                      danger: newMsg.text.length > 90,
                    }">
                    {{ newMsg.text.length }}/90
                  </div>
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementBannerTitle') }}</label>
                  <input class="ann-input" v-model="newMsg.title" maxlength="80" />
                  <div
                    class="ann-char-count"
                    :class="{
                      warning: newMsg.title.length > 64 && newMsg.title.length <= 80,
                      danger: newMsg.title.length > 80,
                    }">
                    {{ newMsg.title.length }}/80
                  </div>
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementSubtitle1') }}</label>
                  <input class="ann-input" v-model="newMsg.subtitle1" maxlength="90" />
                  <div
                    class="ann-char-count"
                    :class="{
                      warning: newMsg.subtitle1.length > 72 && newMsg.subtitle1.length <= 90,
                      danger: newMsg.subtitle1.length > 90,
                    }">
                    {{ newMsg.subtitle1.length }}/90
                  </div>
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementSubtitle2') }}</label>
                  <input class="ann-input" v-model="newMsg.subtitle2" maxlength="80" />
                  <div
                    class="ann-char-count"
                    :class="{
                      warning: newMsg.subtitle2.length > 64 && newMsg.subtitle2.length <= 80,
                      danger: newMsg.subtitle2.length > 80,
                    }">
                    {{ newMsg.subtitle2.length }}/80
                  </div>
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{
                    t('announcementSubtitle3') || 'Subtitle 3'
                  }}</label>
                  <input class="ann-input" v-model="newMsg.subtitle3" maxlength="50" />
                  <div
                    class="ann-char-count"
                    :class="{
                      warning: newMsg.subtitle3.length > 40 && newMsg.subtitle3.length <= 50,
                      danger: newMsg.subtitle3.length > 50,
                    }">
                    {{ newMsg.subtitle3.length }}/50
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="ann-section">
            <button
              class="ann-collapse"
              type="button"
              @click="sectionOpen.style = !sectionOpen.style">
              <span class="caret" :class="{ open: sectionOpen.style }"></span>
              {{ t('announcementSectionStyle') || 'Estilos' }}
            </button>
            <div v-show="sectionOpen.style" class="ann-section-body">
              <div class="ann-grid">
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementTextColor') }}</label>
                  <input class="ann-input" type="color" v-model="newMsg.textColorOverride" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementTitleColor') }}</label>
                  <input class="ann-input" type="color" v-model="newMsg.titleColor" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementSubtitle1Color') }}</label>
                  <input class="ann-input" type="color" v-model="newMsg.subtitle1Color" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementSubtitle2Color') }}</label>
                  <input class="ann-input" type="color" v-model="newMsg.subtitle2Color" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{
                    t('announcementSubtitle3Color') || 'Subtitle 3 color'
                  }}</label>
                  <input class="ann-input" type="color" v-model="newMsg.subtitle3Color" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{
                    t('announcementTextSize') || 'Text size'
                  }}</label>
                  <input
                    class="ann-input"
                    type="number"
                    min="8"
                    max="64"
                    v-model.number="newMsg.textSize" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementTitleSize') }}</label>
                  <input
                    class="ann-input"
                    type="number"
                    min="8"
                    max="72"
                    v-model.number="newMsg.titleSize" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementSubtitle1Size') }}</label>
                  <input
                    class="ann-input"
                    type="number"
                    min="8"
                    max="64"
                    v-model.number="newMsg.subtitle1Size" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementSubtitle2Size') }}</label>
                  <input
                    class="ann-input"
                    type="number"
                    min="8"
                    max="64"
                    v-model.number="newMsg.subtitle2Size" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{
                    t('announcementSubtitle3Size') || 'Subtitle 3 size'
                  }}</label>
                  <input
                    class="ann-input"
                    type="number"
                    min="8"
                    max="64"
                    v-model.number="newMsg.subtitle3Size" />
                </div>
              </div>
            </div>
          </div>

          <div class="ann-section">
            <button class="ann-collapse" type="button" @click="sectionOpen.cta = !sectionOpen.cta">
              <span class="caret" :class="{ open: sectionOpen.cta }"></span>
              {{ t('announcementSectionCTA') || 'CTA' }}
            </button>
            <div v-show="sectionOpen.cta" class="ann-section-body">
              <div class="ann-grid">
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementCtaText') }}</label>
                  <input class="ann-input" v-model="newMsg.ctaText" maxlength="40" />
                  <div
                    class="ann-char-count"
                    :class="{
                      warning: newMsg.ctaText.length > 32 && newMsg.ctaText.length <= 40,
                      danger: newMsg.ctaText.length > 40,
                    }">
                    {{ newMsg.ctaText.length }}/40
                  </div>
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementCtaIcon') }}</label>
                  <input class="ann-input" v-model="newMsg.ctaIcon" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{
                    t('announcementCtaBgColor') || 'CTA background'
                  }}</label>
                  <input class="ann-input" type="color" v-model="newMsg.ctaBgColor" />
                </div>
                <div class="ann-form-group">
                  <label class="ann-form-label">{{
                    t('announcementCtaTextSize') || 'CTA text size'
                  }}</label>
                  <input
                    class="ann-input"
                    type="number"
                    min="8"
                    max="64"
                    v-model.number="newMsg.ctaTextSize" />
                </div>
              </div>
            </div>
          </div>

          <div class="ann-section">
            <button
              class="ann-collapse"
              type="button"
              @click="sectionOpen.media = !sectionOpen.media">
              <span class="caret" :class="{ open: sectionOpen.media }"></span>
              {{ t('announcementSectionMediaTiming') || 'Duración e Imagen' }}
            </button>
            <div v-show="sectionOpen.media" class="ann-section-body">
              <div class="ann-grid">
                <div class="ann-form-group">
                  <label class="ann-form-label">{{ t('announcementDurationSeconds') }}</label>
                  <input class="ann-input" type="number" v-model.number="newMsg.durationSeconds" />
                </div>
                <div class="ann-form-group ann-grid-full">
                  <label class="ann-form-label sr-only">{{ t('announcementImage') }}</label>
                  <div
                    v-if="storageOptions.length"
                    class="flex items-center gap-2 flex-wrap mb-2"
                    role="group"
                    aria-label="Storage provider selection">
                    <label class="ann-form-label mb-0" for="announcement-storage-provider">
                      {{ t('storageProviderLabel') }}
                    </label>
                    <select
                      id="announcement-storage-provider"
                      class="ann-select w-auto"
                      v-model="selectedStorageProvider"
                      :disabled="storageLoading || !storageOptions.length">
                      <option
                        v-for="opt in storageOptions"
                        :key="opt.id"
                        :value="opt.id"
                        :disabled="!opt.available && opt.id !== selectedStorageProvider">
                        {{ opt.label }}
                      </option>
                    </select>
                  </div>
                  <p
                    v-if="providerStatus && !providerStatus.available"
                    class="small text-amber-500 mb-2"
                    role="status">
                    {{ providerStatus.label }} {{ t('storageProviderUnavailable') }}
                  </p>
                  <div class="flex items-center gap-2 flex-wrap">
                    <input
                      ref="annNewImageInput"
                      type="file"
                      accept="image/png,image/jpeg,image/gif"
                      class="sr-only"
                      @change="onNewImageChange" />
                    <button type="button" class="upload-btn" @click="openAnnNewImageDialog">
                      <i class="pi pi-upload mr-2" aria-hidden="true"></i>
                      {{ t('imageChoose') || t('announcementImage') }}
                    </button>
                    <button
                      type="button"
                      class="btn-secondary btn-compact-secondary"
                      @click="openImageLibraryDrawer({ type: 'new' })"
                      :aria-label="t('imageLibraryOpenBtn')">
                      <i class="pi pi-images mr-2" aria-hidden="true"></i>
                      {{ t('imageLibraryOpenBtn') }}
                    </button>
                    <span
                      v-if="newSelectedFileName"
                      class="file-name-label"
                      :title="newSelectedFileName"
                      >{{ newSelectedFileName }}</span
                    >
                    <span
                      v-else-if="newMsg?.imageOriginalName"
                      class="file-name-label"
                      :title="newMsg.imageOriginalName"
                      >{{ newMsg.imageOriginalName }}</span
                    >
                    <button
                      v-if="newMsg.imageFile || newMsg.imageUrl"
                      type="button"
                      class="ann-icon-btn"
                      :aria-label="t('remove')"
                      :title="t('remove')"
                      @click="clearNewImage">
                      <i class="pi pi-trash"></i>
                    </button>
                  </div>
                  <div v-if="imageLibrary.error" class="small mt-1 text-red-500">
                    {{ imageLibrary.error }}
                  </div>
                  <div v-if="newMsg.imageUrl" class="mt-2">
                    <img
                      :src="newMsg.imageUrl"
                      alt="announcement"
                      class="max-h-24 object-contain rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex gap-2 mt-3">
            <button class="btn" type="submit" :disabled="adding">
              {{ adding ? t('commonAdding') : t('announcementAddMessage') }}
            </button>
          </div>
        </form>
      </div>

      <div class="ann-card">
        <div class="ann-card-header">
          <h3 class="ann-card-title">{{ t('announcementBannerPreview') }}</h3>
          <span class="ann-badge">{{ messages.length }}</span>
        </div>
        <div v-if="!messages.length" class="ann-alert info">
          <span>{{ t('announcementNoMessages') }}</span>
        </div>
        <div v-else>
          <div v-for="m in messages" :key="m.id" class="ann-message-item">
            <div class="ann-message-header">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="switch"
                  :aria-pressed="String(m.enabled)"
                  :aria-label="t('announcementEnabled')"
                  @click="(m.enabled = !m.enabled), toggleMessageEnabled(m)">
                  <span class="knob"></span>
                </button>
                <span class="ann-enabled-label">{{ t('announcementEnabled') }}</span>
              </div>
            </div>
            <div class="ann-message-meta">
              <span v-if="m.linkUrl">{{ m.linkUrl }}</span>
              <span v-if="m.durationSeconds"
                >{{ t('announcementDurationSeconds') }}: {{ m.durationSeconds }}</span
              >
            </div>
            <div class="ann-preview" aria-label="Announcement preview">
              <div class="ann-prev-root" :style="getPreviewBg(settings)">
                <div class="ann-prev-content">
                  <div v-if="shouldShowImage(m)" class="ann-prev-media">
                    <img :src="m.imageUrl" class="ann-prev-image" alt="" />
                  </div>
                  <div class="ann-prev-maincol">
                    <div class="ann-prev-textblock">
                      <div
                        v-if="m.title"
                        class="ann-prev-title"
                        :style="{
                          color: m.titleColor || undefined,
                          fontSize:
                            m.titleSize != null ? m.titleSize * previewScale + 'px' : undefined,
                        }">
                        {{ m.title }}
                      </div>
                      <div
                        v-if="m.subtitle1"
                        class="ann-prev-subtitle1"
                        :style="{
                          color: m.subtitle1Color || undefined,
                          fontSize:
                            m.subtitle1Size != null
                              ? m.subtitle1Size * previewScale + 'px'
                              : undefined,
                        }">
                        {{ m.subtitle1 }}
                      </div>
                      <div
                        v-if="m.subtitle2"
                        class="ann-prev-subtitle2"
                        :style="{
                          color: m.subtitle2Color || undefined,
                          fontSize:
                            m.subtitle2Size != null
                              ? m.subtitle2Size * previewScale + 'px'
                              : undefined,
                        }">
                        {{ m.subtitle2 }}
                      </div>
                      <div
                        v-if="m.subtitle3"
                        class="ann-prev-subtitle3"
                        :style="{
                          color: m.subtitle3Color || undefined,
                          fontSize:
                            m.subtitle3Size != null
                              ? m.subtitle3Size * previewScale + 'px'
                              : undefined,
                        }">
                        {{ m.subtitle3 }}
                      </div>
                    </div>
                    <!-- eslint-disable -->
                    <div
                      v-if="m.text && m.text.trim().length"
                      class="ann-prev-text"
                      :style="{
                        color: m.textColorOverride || settings.textColor || undefined,
                        fontSize: m.textSize != null ? m.textSize * previewScale + 'px' : undefined,
                      }"
                      v-html="renderMarkdown(m.text)"></div>
                  </div>
                </div>
                <div v-if="m.ctaText" class="ann-prev-side">
                  <a
                    v-if="m.linkUrl"
                    class="ann-prev-cta"
                    :href="m.linkUrl"
                    target="_blank"
                    rel="noopener"
                    :style="{
                      background: m.ctaBgColor || 'transparent',
                      fontSize:
                        m.ctaTextSize != null ? m.ctaTextSize * previewScale + 'px' : undefined,
                    }">
                    <img v-if="m.ctaIcon" class="ann-prev-cta-icon" :src="m.ctaIcon" alt="" />
                    {{ m.ctaText }}
                  </a>
                  <span
                    v-else
                    class="ann-prev-cta"
                    role="button"
                    tabindex="0"
                    :style="{
                      background: m.ctaBgColor || 'transparent',
                      fontSize:
                        m.ctaTextSize != null ? m.ctaTextSize * previewScale + 'px' : undefined,
                    }">
                    <img v-if="m.ctaIcon" class="ann-prev-cta-icon" :src="m.ctaIcon" alt="" />
                    {{ m.ctaText }}
                  </span>
                </div>
              </div>
            </div>
            <div class="ann-message-actions">
              <button class="ann-action-btn" type="button" @click="(e) => openEdit(m, e)">
                {{ t('commonEdit') }}
              </button>
              <button class="ann-action-btn" type="button" @click="deleteMessage(m)">
                {{ t('commonDelete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-show="activeTab === 'integration'" class="ann-tab-panel" role="tabpanel">
      <div class="ann-card">
        <div class="ann-card-header">
          <h3 class="ann-card-title">{{ t('obsIntegration') }}</h3>
        </div>
        <div class="ann-form-group">
          <label class="ann-form-label mb-1">{{ t('announcementWidgetUrlLabel') }}</label>
          <CopyField :value="widgetUrl" :aria-label="t('announcementWidgetUrlLabel')" />
        </div>
      </div>
    </div>

    <div
      v-if="editing"
      class="ann-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-edit-title">
      <div class="ann-modal" ref="modalRef">
        <h3 id="announcement-edit-title" class="ann-modal-title">{{ t('commonEdit') }}</h3>
        <div class="ann-grid">
          <div class="ann-form-group ann-grid-full">
            <label class="ann-form-label">{{ t('announcementText') }}</label>
            <textarea
              class="ann-textarea ann-textarea--compact"
              v-model="editForm.text"
              maxlength="90" />
            <div
              class="ann-char-count"
              :class="{
                warning: editForm.text.length > 72 && editForm.text.length <= 90,
                danger: editForm.text.length > 90,
              }">
              {{ editForm.text.length }}/90
            </div>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementTextColor') }}</label>
            <input class="ann-input" type="color" v-model="editForm.textColorOverride" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementDurationSeconds') }}</label>
            <input class="ann-input" type="number" v-model.number="editForm.durationSeconds" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementTextSize') || 'Text size' }}</label>
            <input
              class="ann-input"
              type="number"
              min="8"
              max="64"
              v-model.number="editForm.textSize" />
          </div>
        </div>
        <div class="ann-grid">
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementBannerTitle') }}</label>
            <input class="ann-input" v-model="editForm.title" maxlength="80" />
            <div
              class="ann-char-count"
              :class="{
                warning: editForm.title.length > 64 && editForm.title.length <= 80,
                danger: editForm.title.length > 80,
              }">
              {{ editForm.title.length }}/80
            </div>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementSubtitle1') }}</label>
            <input class="ann-input" v-model="editForm.subtitle1" maxlength="90" />
            <div
              class="ann-char-count"
              :class="{
                warning: editForm.subtitle1.length > 72 && editForm.subtitle1.length <= 90,
                danger: editForm.subtitle1.length > 90,
              }">
              {{ editForm.subtitle1.length }}/90
            </div>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementSubtitle2') }}</label>
            <input class="ann-input" v-model="editForm.subtitle2" maxlength="80" />
            <div
              class="ann-char-count"
              :class="{
                warning: editForm.subtitle2.length > 64 && editForm.subtitle2.length <= 80,
                danger: editForm.subtitle2.length > 80,
              }">
              {{ editForm.subtitle2.length }}/80
            </div>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementSubtitle3') || 'Subtitle 3' }}</label>
            <input class="ann-input" v-model="editForm.subtitle3" maxlength="50" />
            <div
              class="ann-char-count"
              :class="{
                warning: editForm.subtitle3.length > 40 && editForm.subtitle3.length <= 50,
                danger: editForm.subtitle3.length > 50,
              }">
              {{ editForm.subtitle3.length }}/50
            </div>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementTitleColor') }}</label>
            <input class="ann-input" type="color" v-model="editForm.titleColor" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementSubtitle1Color') }}</label>
            <input class="ann-input" type="color" v-model="editForm.subtitle1Color" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementSubtitle2Color') }}</label>
            <input class="ann-input" type="color" v-model="editForm.subtitle2Color" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{
              t('announcementSubtitle3Color') || 'Subtitle 3 color'
            }}</label>
            <input class="ann-input" type="color" v-model="editForm.subtitle3Color" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementTitleSize') }}</label>
            <input
              class="ann-input"
              type="number"
              min="8"
              max="72"
              v-model.number="editForm.titleSize" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementSubtitle1Size') }}</label>
            <input
              class="ann-input"
              type="number"
              min="8"
              max="64"
              v-model.number="editForm.subtitle1Size" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementSubtitle2Size') }}</label>
            <input
              class="ann-input"
              type="number"
              min="8"
              max="64"
              v-model.number="editForm.subtitle2Size" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{
              t('announcementSubtitle3Size') || 'Subtitle 3 size'
            }}</label>
            <input
              class="ann-input"
              type="number"
              min="8"
              max="64"
              v-model.number="editForm.subtitle3Size" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementCtaText') }}</label>
            <input class="ann-input" v-model="editForm.ctaText" maxlength="40" />
            <div
              class="ann-char-count"
              :class="{
                warning: editForm.ctaText.length > 32 && editForm.ctaText.length <= 40,
                danger: editForm.ctaText.length > 40,
              }">
              {{ editForm.ctaText.length }}/40
            </div>
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{ t('announcementCtaIcon') }}</label>
            <input class="ann-input" v-model="editForm.ctaIcon" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{
              t('announcementCtaBgColor') || 'CTA background'
            }}</label>
            <input class="ann-input" type="color" v-model="editForm.ctaBgColor" />
          </div>
          <div class="ann-form-group">
            <label class="ann-form-label">{{
              t('announcementCtaTextSize') || 'CTA text size'
            }}</label>
            <input
              class="ann-input"
              type="number"
              min="8"
              max="64"
              v-model.number="editForm.ctaTextSize" />
          </div>
        </div>
        <div class="ann-form-group flex items-center gap-6">
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="switch"
              :aria-pressed="String(editForm.enabled)"
              :aria-label="t('announcementEnabled')"
              @click="editForm.enabled = !editForm.enabled">
              <span class="knob"></span>
            </button>
            <span class="ann-enabled-label">{{ t('announcementEnabled') }}</span>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="switch"
              :aria-pressed="String(editForm.removeImage)"
              :aria-label="t('announcementRemoveImage')"
              @click="editForm.removeImage = !editForm.removeImage">
              <span class="knob"></span>
            </button>
            <span class="ann-enabled-label">{{ t('announcementRemoveImage') }}</span>
          </div>
        </div>

        <div class="ann-form-group">
          <label class="ann-form-label">{{ t('announcementImage') }}</label>
          <div
            v-if="storageOptions.length"
            class="flex items-center gap-2 flex-wrap mb-2"
            role="group"
            aria-label="Storage provider selection">
            <label class="ann-form-label mb-0" for="announcement-storage-provider-edit">
              {{ t('storageProviderLabel') }}
            </label>
            <select
              id="announcement-storage-provider-edit"
              class="ann-select w-auto"
              v-model="selectedStorageProvider"
              :disabled="storageLoading || !storageOptions.length">
              <option
                v-for="opt in storageOptions"
                :key="opt.id"
                :value="opt.id"
                :disabled="!opt.available && opt.id !== selectedStorageProvider">
                {{ opt.label }}
              </option>
            </select>
          </div>
          <p
            v-if="providerStatus && !providerStatus.available"
            class="small text-amber-500 mb-2"
            role="status">
            {{ providerStatus.label }} {{ t('storageProviderUnavailable') }}
          </p>
          <div class="flex items-center gap-2 flex-wrap">
            <input
              ref="annEditImageInput"
              type="file"
              accept="image/png,image/jpeg,image/gif"
              class="sr-only"
              @change="onEditImageChange" />
            <button type="button" class="upload-btn" @click="openAnnEditImageDialog">
              <i class="pi pi-upload mr-2" aria-hidden="true"></i>
              {{ t('imageChoose') || t('announcementImage') }}
            </button>
            <button
              type="button"
              class="btn-secondary btn-compact-secondary"
              :disabled="!editForm.value?.id"
              @click="
                openImageLibraryDrawer({ type: 'edit', messageId: editForm.value?.id || null })
              "
              :aria-label="t('imageLibraryOpenBtn')">
              <i class="pi pi-images mr-2" aria-hidden="true"></i>
              {{ t('imageLibraryOpenBtn') }}
            </button>
            <span
              v-if="editSelectedFileName"
              class="file-name-label"
              :title="editSelectedFileName"
              >{{ editSelectedFileName }}</span
            >
            <span
              v-else-if="editForm.value?.imageOriginalName"
              class="file-name-label"
              :title="editForm.value.imageOriginalName"
              >{{ editForm.value.imageOriginalName }}</span
            >
            <button
              v-if="
                (editForm.value?.imageUrl && !editForm.value?.removeImage) || editSelectedFileName
              "
              type="button"
              class="ann-icon-btn"
              :aria-label="t('remove')"
              :title="t('remove')"
              @click="clearEditImage">
              <i class="pi pi-trash"></i>
            </button>
          </div>
          <div v-if="editForm.value?.imageUrl && !editForm.value?.removeImage" class="mt-2">
            <img
              :src="editForm.value.imageUrl"
              alt="announcement"
              class="max-h-24 object-contain rounded" />
          </div>
        </div>
        <div class="flex gap-2 mt-4">
          <button class="btn" :disabled="updating" @click="submitEdit">
            {{ updating ? t('commonUpdating') : t('commonSave') }}
          </button>
          <button class="btn" @click="closeEdit">{{ t('commonClose') }}</button>
        </div>
      </div>
    </div>
    <ImageLibraryDrawer
      :open="imageLibrary.open"
      :items="imageLibrary.items"
      :loading="imageLibrary.loading"
      :error="imageLibrary.error"
      @close="closeImageLibraryDrawer"
      @refresh="fetchImageLibrary(true)"
      @select="onLibraryImageSelect" />
  </section>
</template>

<script setup>
import { reactive, ref, watch, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import CopyField from '../shared/CopyField.vue';
import ImageLibraryDrawer from '../shared/ImageLibraryDrawer.vue';
import { useAnnouncementPanel } from './AnnouncementPanel.js';
import { useStorageProviders } from '../../composables/useStorageProviders.js';
import api from '../../services/api.js';
import { pushToast } from '../../services/toast';
import './AnnouncementPanel.css';

const { t } = useI18n();
const state = useAnnouncementPanel(t);
const {
  settings,
  cooldownMinutes,
  messages,
  newMsg,
  errors,
  editing,
  editForm,
  savingSettings,
  adding,
  updating,
  modalRef,
  widgetUrl,
  activeTab,
  load,
  saveSettings,
  addMessage,
  toggleMessageEnabled,
  openEdit,
  deleteMessage,
  submitEdit,
  closeEdit,
} = state;
const storage = useStorageProviders();
const providerStatus = computed(() => {
  const selected = storage.selectedProvider.value;
  return storage.providerOptions.value.find((opt) => opt.id === selected) || null;
});
const storageOptions = computed(() => storage.providerOptions.value);
const storageLoading = computed(() => storage.loading.value);
const selectedStorageProvider = computed({
  get: () => storage.selectedProvider.value,
  set: (val) => storage.setSelectedProvider(val),
});

function resolveStorageSelection(preferred = '') {
  const candidates = [];
  if (preferred) candidates.push(preferred);
  storage.ensureSelection(candidates);
}

resolveStorageSelection();

watch(storageOptions, () => {
  resolveStorageSelection(selectedStorageProvider.value);
});

watch(messages, (list) => {
  if (!Array.isArray(list)) return;
  list.forEach((m) => {
    if (m?.imageStorageProvider) storage.registerProvider(m.imageStorageProvider);
  });
  storage.ensureSelection([]);
});

watch(editing, (val) => {
  if (val && editForm.value?.imageStorageProvider) {
    storage.registerProvider(editForm.value.imageStorageProvider);
    storage.ensureSelection([editForm.value.imageStorageProvider]);
  }
});

const imageLibrary = reactive({
  items: [],
  loading: false,
  error: '',
  loaded: false,
  open: false,
  target: null,
});

const tabs = [
  { id: 'settings', label: t('settings') || t('announcementSettings') },
  { id: 'integration', label: t('obsIntegration') },
];

const sectionOpen = reactive({ content: true, style: false, cta: false, media: false });
const annNewImageInput = ref(null);
const annEditImageInput = ref(null);
const newSelectedFileName = ref('');

function upsertLibraryItem(entry) {
  if (!entry || !entry.id) return;
  const normalized = {
    id: entry.id,
    url: entry.url || '',
    provider: entry.provider || '',
    path: entry.path || '',
    size: Number(entry.size) || 0,
    originalName: entry.originalName || '',
    uploadedAt: entry.uploadedAt || new Date().toISOString(),
    sha256: entry.sha256 || '',
    fingerprint: entry.fingerprint || '',
    width: Number(entry.width) || undefined,
    height: Number(entry.height) || undefined,
  };
  const existingIndex = imageLibrary.items.findIndex((item) => item && item.id === normalized.id);
  if (existingIndex !== -1) {
    imageLibrary.items.splice(existingIndex, 1);
  }
  imageLibrary.items.unshift(normalized);
  if (imageLibrary.items.length > 100) {
    imageLibrary.items.splice(100);
  }
  imageLibrary.loaded = true;
}

async function fetchImageLibrary(force = false) {
  if (imageLibrary.loading) return;
  if (!force && imageLibrary.loaded) return;
  try {
    imageLibrary.loading = true;
    imageLibrary.error = '';
    const { data } = await api.get(
      '/api/announcement/image-library',
      force ? { params: { ts: Date.now() } } : undefined
    );
    const items = Array.isArray(data?.items) ? data.items : [];
    imageLibrary.items = items
      .map((item) => ({
        id: item?.id || '',
        url: item?.url || '',
        provider: item?.provider || '',
        path: item?.path || '',
        size: Number(item?.size) || 0,
        originalName: item?.originalName || '',
        uploadedAt: item?.uploadedAt || new Date(0).toISOString(),
        sha256: item?.sha256 || '',
        fingerprint: item?.fingerprint || '',
        width: Number(item?.width) || undefined,
        height: Number(item?.height) || undefined,
      }))
      .filter((entry) => entry.id);
    imageLibrary.loaded = true;
  } catch (error) {
    imageLibrary.error = t('imageLibraryLoadFailed');
    console.error('[announcement] image library load failed', error);
  } finally {
    imageLibrary.loading = false;
  }
}

async function ensureImageLibraryLoaded(force = false) {
  if (force) {
    await fetchImageLibrary(true);
    return;
  }
  if (!imageLibrary.loaded) {
    await fetchImageLibrary(false);
  }
}

async function openImageLibraryDrawer(target) {
  await ensureImageLibraryLoaded(false);
  imageLibrary.target = target || null;
  imageLibrary.error = '';
  imageLibrary.open = true;
}

function closeImageLibraryDrawer() {
  imageLibrary.open = false;
  imageLibrary.target = null;
}

function applyLibraryToNew(entry) {
  if (!entry || !entry.id) return;
  if (newMsg && 'value' in newMsg && newMsg.value) {
    newMsg.value.imageFile = null;
    newMsg.value.imageLibraryId = entry.id;
    newMsg.value.imageUrl = entry.url || '';
    newMsg.value.imageStorageProvider = entry.provider || '';
    newMsg.value.imageStoragePath = entry.path || '';
    newMsg.value.imageSha256 = entry.sha256 || '';
    newMsg.value.imageFingerprint = entry.fingerprint || '';
    newMsg.value.imageOriginalName = entry.originalName || '';
  }
  newSelectedFileName.value = '';
  upsertLibraryItem(entry);
  if (entry.provider) {
    storage.registerProvider(entry.provider);
    storage.ensureSelection([entry.provider]);
  }
}

async function applyLibraryToEdit(entry) {
  if (!entry || !entry.id) {
    closeImageLibraryDrawer();
    return;
  }
  const target = imageLibrary.target;
  const messageId = target?.messageId || editForm.value?.id;
  if (!messageId) {
    closeImageLibraryDrawer();
    return;
  }
  try {
    const fd = new FormData();
    fd.append('libraryId', entry.id);
    fd.append('imageLibraryId', entry.id);
    if (entry.url) fd.append('imageUrl', entry.url);
    if (entry.provider) fd.append('imageStorageProvider', entry.provider);
    if (entry.path) fd.append('imageStoragePath', entry.path);
    if (entry.sha256) fd.append('imageSha256', entry.sha256);
    if (entry.fingerprint) fd.append('imageFingerprint', entry.fingerprint);
    if (entry.originalName) fd.append('imageOriginalName', entry.originalName);
    const { data } = await api.put(`/api/announcement/message/${messageId}/image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (data?.success) {
      const libraryEntry = data.libraryItem || entry;
      pushToast({ type: 'success', message: t('announcementMsgUpdated') });
      editForm.value.removeImage = false;
      editForm.value.imageUrl = data.message?.imageUrl || libraryEntry.url || '';
      editForm.value.imageLibraryId = data.message?.imageLibraryId || libraryEntry.id || '';
      editForm.value.imageStorageProvider =
        data.message?.imageStorageProvider || libraryEntry.provider || '';
      editForm.value.imageStoragePath = data.message?.imageStoragePath || libraryEntry.path || '';
      editForm.value.imageSha256 = data.message?.imageSha256 || libraryEntry.sha256 || '';
      editForm.value.imageFingerprint =
        data.message?.imageFingerprint || libraryEntry.fingerprint || '';
      editForm.value.imageOriginalName =
        data.message?.imageOriginalName || libraryEntry.originalName || '';
      editSelectedFileName.value = libraryEntry.originalName || '';
      upsertLibraryItem(libraryEntry);
      if (libraryEntry.provider) {
        storage.registerProvider(libraryEntry.provider);
        storage.ensureSelection([libraryEntry.provider]);
      }
      await load();
    } else {
      pushToast({ type: 'error', message: data?.error || t('announcementSaveSettingsFailed') });
    }
  } catch (error) {
    pushToast({ type: 'error', message: t('announcementSaveSettingsFailed') });
    console.error('[announcement] apply library image failed', error);
  } finally {
    closeImageLibraryDrawer();
  }
}

async function onLibraryImageSelect(entry) {
  if (!entry || !entry.id) {
    closeImageLibraryDrawer();
    return;
  }
  const target = imageLibrary.target;
  if (!target) {
    closeImageLibraryDrawer();
    return;
  }
  if (target.type === 'new') {
    applyLibraryToNew(entry);
    closeImageLibraryDrawer();
  } else if (target.type === 'edit') {
    await applyLibraryToEdit(entry);
  } else {
    closeImageLibraryDrawer();
  }
}

const previewScale = 0.65;

function openAnnNewImageDialog() {
  if (annNewImageInput.value) {
    annNewImageInput.value.value = '';
    annNewImageInput.value.click();
  }
}
function onNewImageChange(e) {
  try {
    const file = e?.target?.files?.[0];
    if (!file) return;
    newSelectedFileName.value = file.name || '';
    state.onNewImage({ target: { files: [file] } });
  } catch {}
}

const editSelectedFileName = ref('');
function clearEditImage() {
  editSelectedFileName.value = '';
  if (annEditImageInput.value) annEditImageInput.value.value = '';

  if (editForm && 'value' in editForm && editForm.value) {
    editForm.value.removeImage = true;
    editForm.value.imageUrl = '';
    editForm.value.imageLibraryId = '';
    editForm.value.imageStorageProvider = '';
    editForm.value.imageStoragePath = '';
    editForm.value.imageSha256 = '';
    editForm.value.imageFingerprint = '';
    editForm.value.imageOriginalName = '';
  } else if (state?.editForm && 'value' in state.editForm) {
    state.editForm.value.removeImage = true;
    state.editForm.value.imageUrl = '';
    state.editForm.value.imageLibraryId = '';
    state.editForm.value.imageStorageProvider = '';
    state.editForm.value.imageStoragePath = '';
    state.editForm.value.imageSha256 = '';
    state.editForm.value.imageFingerprint = '';
    state.editForm.value.imageOriginalName = '';
  }
}
watch(editing, (val) => {
  if (val) {
    editSelectedFileName.value = '';
    if (annEditImageInput.value) annEditImageInput.value.value = '';
  }
});

function getPreviewBg(s) {
  try {
    const useGradient = s.bannerBgType === 'gradient' && s.gradientFrom && s.gradientTo;
    const bg = useGradient
      ? `linear-gradient(135deg, ${s.gradientFrom}, ${s.gradientTo})`
      : s.bgColor || '#0e1014';
    const color = s.textColor || '#ffffff';
    return { background: bg, color };
  } catch {
    return {};
  }
}

function escapeHTML(str = '') {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[c] || c)
  );
}
function stripDangerous(html) {
  return html
    .replace(/<\/(?:script|style)[^>]*>/gi, '')
    .replace(/<(?:script|style)[^>]*>[\s\S]*?<\/(?:script|style)>/gi, '')
    .replace(/on[a-z]+="[^"]*"/gi, '');
}
function renderMarkdown(text = '') {
  let html = escapeHTML(text);
  html = html.replace(/\*\*(.+?)\*\*/g, (_, g1) => '<strong>' + g1 + '</strong>');
  html = html.replace(/\*(.+?)\*/g, (_, g1) => '<em>' + g1 + '</em>');
  html = html.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, (m, label, url) => {
    const safeLabel = escapeHTML(label);
    const safeUrl = url.replace(/"|'|\\/g, '');
    return (
      '<a href="' +
      safeUrl +
      '" target="_blank" rel="noopener" class="ann-link">' +
      safeLabel +
      '</a>'
    );
  });
  return stripDangerous(html);
}

function openAnnEditImageDialog() {
  if (annEditImageInput.value) {
    annEditImageInput.value.value = '';
    annEditImageInput.value.click();
  }
}
function onEditImageChange(e) {
  try {
    const file = e?.target?.files?.[0];
    editSelectedFileName.value = file ? file.name : '';
    if (!file) return;
    state
      .onEditImage(
        { target: { files: [file] } },
        { storageProvider: selectedStorageProvider.value }
      )
      .then((data) => {
        if (data?.message?.imageOriginalName) {
          editSelectedFileName.value = data.message.imageOriginalName;
        } else if (data?.libraryItem?.originalName) {
          editSelectedFileName.value = data.libraryItem.originalName;
        }
        if (data?.libraryItem) {
          upsertLibraryItem(data.libraryItem);
          if (data.libraryItem.provider) {
            storage.registerProvider(data.libraryItem.provider);
            storage.ensureSelection([data.libraryItem.provider]);
          }
        }
      });
  } catch {}
}

function clearNewImage() {
  try {
    if (newMsg && 'value' in newMsg && newMsg.value) {
      newMsg.value.imageFile = null;
      newMsg.value.imageUrl = '';
      newMsg.value.imageLibraryId = '';
      newMsg.value.imageStorageProvider = '';
      newMsg.value.imageStoragePath = '';
      newMsg.value.imageSha256 = '';
      newMsg.value.imageFingerprint = '';
      newMsg.value.imageOriginalName = '';
    } else if (state?.newMsg && 'value' in state.newMsg) {
      state.newMsg.value.imageFile = null;
      state.newMsg.value.imageUrl = '';
      state.newMsg.value.imageLibraryId = '';
      state.newMsg.value.imageStorageProvider = '';
      state.newMsg.value.imageStoragePath = '';
      state.newMsg.value.imageSha256 = '';
      state.newMsg.value.imageFingerprint = '';
      state.newMsg.value.imageOriginalName = '';
    }
    if (annNewImageInput.value) annNewImageInput.value.value = '';
    newSelectedFileName.value = '';
  } catch {}
}

async function handleAddMessage() {
  const data = await addMessage({ storageProvider: selectedStorageProvider.value });
  if (data?.libraryItem) {
    upsertLibraryItem(data.libraryItem);
    if (data.libraryItem.provider) {
      storage.registerProvider(data.libraryItem.provider);
      storage.ensureSelection([data.libraryItem.provider]);
    }
  }
}

function shouldShowImage(m) {
  try {
    if (editing?.value && editForm?.value && editForm.value.id === m.id) {
      if (editForm.value.removeImage) return false;
    }
    return !!m.imageUrl;
  } catch {
    return !!(m && m.imageUrl);
  }
}

onMounted(async () => {
  await storage.fetchProviders();
  resolveStorageSelection(selectedStorageProvider.value);
});
</script>

<style scoped>
.input-error {
  border-color: #b91c1c !important;
}
.upload-btn {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.6rem;
  border: 2px solid var(--accent);
  color: var(--accent);
  background: transparent;
  border-radius: 2px;
  line-height: 1;
  box-shadow: none;
  cursor: pointer;
}
.upload-btn:hover {
  background: rgba(79, 54, 255, 0.08);
}
.upload-btn:focus-visible {
  outline: 2px solid rgba(79, 54, 255, 0.35);
  outline-offset: 1px;
}

.ann-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: #ff0149;
  background: transparent;
  border-radius: 2px;
}
.ann-icon-btn:hover {
  background: rgba(100, 116, 139, 0.08);
}
.ann-icon-btn .pi {
  font-size: 0.9rem;
}

.file-name-label {
  font-size: 0.85rem;
  color: #64748b;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
