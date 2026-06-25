import json

with open('messages/en.json', encoding='utf-8') as f:
    en = json.load(f)
with open('messages/he.json', encoding='utf-8') as f:
    he = json.load(f)

changes = []

def fix(data, lang, path, new_val):
    keys = path.split('.')
    obj = data
    for k in keys[:-1]:
        if k not in obj:
            print(f'MISSING PATH: {lang} {path}'); return
        obj = obj[k]
    last = keys[-1]
    if last not in obj:
        print(f'MISSING KEY: {lang} {path}'); return
    old = obj[last]
    if old == new_val:
        print(f'ALREADY_OK: {lang} {path}'); return
    obj[last] = new_val
    changes.append(f'OK: {lang} {path}: {repr(old)[:60]} -> {repr(new_val)[:60]}')

def fix_in(data, lang, path, old_sub, new_sub):
    """Replace a substring within an existing value."""
    keys = path.split('.')
    obj = data
    for k in keys[:-1]:
        if k not in obj:
            print(f'MISSING PATH: {lang} {path}'); return
        obj = obj[k]
    last = keys[-1]
    if last not in obj:
        print(f'MISSING KEY: {lang} {path}'); return
    old_val = obj[last]
    if old_sub not in old_val:
        print(f'MISSING SUBSTRING in {lang} {path}: {repr(old_sub)}'); return
    new_val = old_val.replace(old_sub, new_sub)
    if new_val == old_val:
        print(f'ALREADY_OK: {lang} {path}'); return
    obj[last] = new_val
    changes.append(f'OK: {lang} {path}: ...{repr(old_sub)[:30]}... -> ...{repr(new_sub)[:30]}...')

# ===== EN FIXES =====
fix(en, 'en', 'nav.clarificationShort', 'Clarification')
fix(en, 'en', 'lifeCoach.stepStatus.pending', 'Pending')
fix(en, 'en', 'lifeCoach.markPartial', 'Partially done (add a note)')
fix(en, 'en', 'formulation.liveSummary.formulation', 'Summary')
fix(en, 'en', 'formulation.liveSummary.phases.formulation', 'Collaborative summary')

# ===== HE FIXES =====

# Untranslated gamification titles (HIGH)
fix(he, 'he', 'gamification.identityTitles.builder', 'הבונה')
fix(he, 'he', 'gamification.identityTitles.finisher', 'המסיים')
fix(he, 'he', 'gamification.identityTitles.comebackArtist', 'אמן הקאמבק')
fix(he, 'he', 'gamification.identityTitles.strategist', 'האסטרטג')

# featureUnlock and home toolsCoach untranslated (HIGH)
fix(he, 'he', 'featureUnlock.life_coach', 'מאמן חיים')
fix(he, 'he', 'home.toolsCoach', 'מאמן חיים')

# howItWorks check-in: HE described morning ritual instead of check-in (HIGH)
fix(he, 'he', 'home.howItWorks.steps.checkin.title',
    'צ\'ק-אין')
fix(he, 'he', 'home.howItWorks.steps.checkin.body',
    'דופק קצר — '
    'האנרגיה והמצב '
    'שלך מעצבים '
    'את הצעדים '
    'של היום.')

# Plan B: inappropriate connotation in HE (HIGH)
fix(he, 'he', 'formulation.challenge.fallbackPlan',
    'תוכנית חלופית')

# liveSummary: 'Formulation'/'ניסוח' is internal term
fix(he, 'he', 'formulation.liveSummary.formulation',
    'סיכום')
fix(he, 'he', 'formulation.liveSummary.phases.formulation',
    'סיכום משותף')

# morningRitual pageTitle inconsistency with nav label everywhere else
fix(he, 'he', 'morningRitual.pageTitle',
    'טקס בוקר')

# Step filter chips: incorrect plural (should match singular status display)
fix(he, 'he', 'lifeCoach.stepFilters.completed',
    'הושלם')
fix(he, 'he', 'lifeCoach.stepFilters.skipped',
    'דולג')
fix(he, 'he', 'lifeCoach.stepFilters.pending',
    'ממתין')

# onboardingTitle: masculine 'בוא' -> gender-neutral 'בואו'
fix_in(he, 'he', 'lifeCoach.onboardingTitle',
       'בוא נתחיל',
       'בואו נתחיל')

# Direct address: keep masculine defaults in en.json parity only — Hebrew uses gendered message objects.

# simpleTasks.generalManager: 'עולם' -> 'תחום'
fix_in(he, 'he', 'simpleTasks.generalManager.body',
       'לעולם הזה',
       'לתחום הזה')
fix_in(he, 'he', 'simpleTasks.generalManager.empty',
       'בעולם הזה',
       'בתחום הזה')

# gamification mysteryUnlock: 'insight' untranslated
fix_in(he, 'he', 'gamification.mysteryUnlock.newInsight',
       'insight', 'תובנה')

# morningRitual standard includes: 'affirmation' untranslated
fix_in(he, 'he', 'morningRitual.mode.standardIncludes',
       'affirmation',
       'היגד עצמי')

# challenge types: 'streak'/'recovery' untranslated
fix_in(he, 'he', 'formulation.challenge.types.flexible_parent',
       'streak', 'רצף')
fix_in(he, 'he', 'formulation.challenge.types.recovery_gentle',
       'recovery רך',
       'התאוששות עדינה')

# planB.lineWithAction: 'Plan B' -> 'תוכנית חלופית'
fix_in(he, 'he', 'behaviorScience.planB.lineWithAction',
       'Plan B',
       'תוכנית חלופית')

# antiShame and behaviorScore: 'partial' untranslated
fix_in(he, 'he', 'behaviorScience.antiShame.partial',
       'partial נספר',
       'גם חלקי נספר')
fix_in(he, 'he', 'behaviorScience.behaviorScore.hint',
       'partial נחשב',
       'חלקי נחשב')

# wheelIntro gender variants are maintained via scripts/convert-he-gender-messages.py

# Save
with open('messages/en.json', 'w', encoding='utf-8') as f:
    json.dump(en, f, ensure_ascii=False, indent=2)
    f.write('\n')
with open('messages/he.json', 'w', encoding='utf-8') as f:
    json.dump(he, f, ensure_ascii=False, indent=2)
    f.write('\n')

# Validate
with open('messages/en.json', encoding='utf-8') as f:
    en2 = json.load(f)
with open('messages/he.json', encoding='utf-8') as f:
    he2 = json.load(f)

def count_keys(d):
    return sum(count_keys(v) if isinstance(v, dict) else 1 for v in d.values())

en_count = count_keys(en2)
he_count = count_keys(he2)
print(f'JSON valid. keys en={en_count} he={he_count}')
print(f'Total changes: {len(changes)}')
print()
for c in changes:
    print(c)
