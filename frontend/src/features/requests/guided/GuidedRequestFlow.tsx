import { useEffect, useMemo, useRef, useState, ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../../lib/store';
import { useCreateRequest } from '../../../hooks/queries';
import { PhoneFlow } from './PhoneFlow';
import { LaptopFlow } from './LaptopFlow';
import { AccessoriesFlow } from './AccessoriesFlow';
import { ClothingFlow } from './ClothingFlow';
import { ShoesFlow } from './ShoesFlow';
import { GuidedProgressBar } from './GuidedProgressBar';
import { GuidedStepHeader } from './GuidedStepHeader';
import { accessoryIssues } from './data/accessoryData';
import { clothingIssues, shoeIssues } from './data/issueOptions';
import { laptopIssues } from './data/laptopBrands';
import { phoneIssues } from './data/phoneBrands';
import './guidedFlow.css';
import { Camera, Check, Hammer, HelpCircle, Laptop, Shirt, Smartphone, X } from 'lucide-react';
import { PriorityLevel, RequestCategory } from '../../../types';

const CATEGORY_OPTIONS = [
  { value: 'phone' as const, label: 'Phone Repair', icon: Smartphone, subtitle: 'Screen · Battery · Keys' },
  { value: 'laptop' as const, label: 'Laptop Repair', icon: Laptop, subtitle: 'Screen · Power · System' },
  { value: 'clothing' as const, label: 'Clothing Fix', icon: Shirt, subtitle: 'Uniform · Alterations · Stitching' },
  { value: 'shoe' as const, label: 'Shoe Repair', icon: Hammer, subtitle: 'Soles · Stitching · Restoration' },
  { value: 'accessories' as const, label: 'Accessories Fix', icon: Camera, subtitle: 'Chargers · Headphones · Small items' },
  { value: 'other' as const, label: 'Other Fix', icon: HelpCircle, subtitle: 'General repair support' },
];

const PRIORITY_OPTIONS: { value: PriorityLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const CATEGORY_LABELS: Record<RequestCategory, string> = {
  phone: 'Phone Repair',
  laptop: 'Laptop Repair',
  clothing: 'Clothing Fix',
  shoe: 'Shoe Repair',
  accessories: 'Accessories Fix',
  other: 'Other Fix',
};

interface RequestFlowState {
  category: RequestCategory | null;
  brand: string | null;
  brandId: string | null;
  model: string | null;
  modelId: string | null;
  accessoryType: string | null;
  accessoryTypeId: string | null;
  issueType: string[];
  customIssue: string;
  description: string;
  photos: string[];
  priority: PriorityLevel;
  phoneNumber: string;
  additionalNotes: string;
  additionalIssue: string;
}

type FlowStep = 'category' | 'brand' | 'model' | 'accessoryType' | 'issues' | 'details' | 'review';

const VALID_CATEGORIES: RequestCategory[] = ['phone', 'laptop', 'accessories', 'clothing', 'shoe', 'other'];

const createInitialState = (category: RequestCategory | null): RequestFlowState => ({
  category,
  brand: null,
  brandId: null,
  model: null,
  modelId: null,
  accessoryType: null,
  accessoryTypeId: null,
  issueType: [],
  customIssue: '',
  description: '',
  photos: [],
  priority: 'normal',
  phoneNumber: '',
  additionalNotes: '',
  additionalIssue: '',
});

const getStepSequence = (category: RequestCategory | null): FlowStep[] => {
  if (!category) {
    return ['category'];
  }

  if (category === 'phone' || category === 'laptop') {
    return ['brand', 'model', 'issues', 'details', 'review'];
  }

  if (category === 'accessories') {
    return ['accessoryType', 'brand', 'issues', 'details', 'review'];
  }

  if (category === 'clothing' || category === 'shoe') {
    return ['issues', 'details', 'review'];
  }

  return ['details', 'review'];
};

const resolveIssueLabels = (issueIds: string[], customIssue: string) => {
  const options = [...phoneIssues, ...laptopIssues, ...accessoryIssues, ...clothingIssues, ...shoeIssues];
  return issueIds.map((issueId) => {
    if (issueId === 'other_issue') {
      return customIssue.trim() || 'Other';
    }
    const option = options.find((item) => item.id === issueId);
    return option?.label ?? issueId;
  });
};

export function UnifiedRequestFlow() {
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const createMutation = useCreateRequest();

  const categoryParam = params.category as RequestCategory | undefined;
  const initialCategory = categoryParam && VALID_CATEGORIES.includes(categoryParam) ? categoryParam : null;

  const [requestState, setRequestState] = useState<RequestFlowState>(() => createInitialState(initialCategory));
  const [currentStep, setCurrentStep] = useState(0);
  const [animationClass, setAnimationClass] = useState('step-enter-active');
  const [renderKey, setRenderKey] = useState(`step-${categoryParam || 'select'}-0`);
  const [isAnimating, setIsAnimating] = useState(false);
  const [detailsErrors, setDetailsErrors] = useState({ description: '', phoneNumber: '', photos: '' });
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const detailsTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previousCategoryParam = useRef<RequestCategory | undefined>(categoryParam);

  const stepSequence = useMemo(() => getStepSequence(requestState.category), [requestState.category]);
  const activeStep = stepSequence[currentStep] ?? stepSequence[stepSequence.length - 1];
  const totalSteps = stepSequence.length;
  const stepCountLabel = `Step ${Math.min(currentStep + 1, totalSteps)} of ${totalSteps}`;

  useEffect(() => {
    if (categoryParam && !VALID_CATEGORIES.includes(categoryParam)) {
      navigate('/app/requests/new/select', { replace: true });
      return;
    }

    if (categoryParam && categoryParam !== requestState.category) {
      setRequestState(createInitialState(categoryParam ?? null));
      setCurrentStep(0);
      setAnimationClass('step-enter-active');
      setRenderKey(`step-${categoryParam}-0`);
      setDetailsErrors({ description: '', phoneNumber: '', photos: '' });
      setConfirmChecked(false);
      setSubmitError(null);
    }

    if (!categoryParam && previousCategoryParam.current && requestState.category) {
      setRequestState(createInitialState(null));
      setCurrentStep(0);
      setAnimationClass('step-enter-active');
      setRenderKey(`step-select-0`);
      setDetailsErrors({ description: '', phoneNumber: '', photos: '' });
      setConfirmChecked(false);
      setSubmitError(null);
    }

    previousCategoryParam.current = categoryParam;
  }, [categoryParam, navigate, requestState.category]);

  useEffect(() => {
    if (activeStep === 'details' && user?.phone && requestState.phoneNumber.trim() === '') {
      setRequestState((prev) => ({ ...prev, phoneNumber: user.phone || '' }));
    }
  }, [activeStep, user?.phone, requestState.phoneNumber]);

  useEffect(() => {
    if (detailsTextareaRef.current) {
      detailsTextareaRef.current.style.height = 'auto';
      const scrollHeight = Math.min(detailsTextareaRef.current.scrollHeight, 240);
      detailsTextareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [requestState.description]);

  const mergeState = (updates: Partial<RequestFlowState>) => {
    setRequestState((previous) => ({ ...previous, ...updates }));
  };

  const handleCategorySelect = (category: RequestCategory) => {
    setRequestState(createInitialState(category));
    setCurrentStep(0);
    setAnimationClass('step-enter-active');
    setRenderKey(`step-${category}-0`);
    setDetailsErrors({ description: '', phoneNumber: '', photos: '' });
    setConfirmChecked(false);
    setSubmitError(null);
  };

  const getNextStep = (step: number) => {
    if (requestState.category === 'phone' || requestState.category === 'laptop') {
      if (step === 0 && requestState.brandId?.includes('other')) {
        return 2;
      }
      return Math.min(step + 1, stepSequence.length - 1);
    }

    if (requestState.category === 'accessories') {
      if (step === 0 && requestState.accessoryTypeId === 'other_accessory') {
        return 2;
      }
      return Math.min(step + 1, stepSequence.length - 1);
    }

    return Math.min(step + 1, stepSequence.length - 1);
  };

  const getPreviousStep = (step: number) => {
    if (step === 0) {
      return 0;
    }

    if (requestState.category === 'phone' || requestState.category === 'laptop') {
      if (step === 2 && requestState.brandId?.includes('other')) {
        return 0;
      }
      return Math.max(step - 1, 0);
    }

    if (requestState.category === 'accessories') {
      if (step === 2 && requestState.accessoryTypeId === 'other_accessory') {
        return 0;
      }
      return Math.max(step - 1, 0);
    }

    return Math.max(step - 1, 0);
  };

  const animateToStep = (nextStep: number, nextDirection: 'forward' | 'back') => {
    if (isAnimating || nextStep === currentStep) {
      return;
    }

    setIsAnimating(true);
    const exitClass = nextDirection === 'forward' ? 'step-exit-to-left' : 'step-exit-to-right';
    setAnimationClass(exitClass);

    window.setTimeout(() => {
      setCurrentStep(nextStep);
      setRenderKey(`step-${requestState.category || 'select'}-${nextStep}-${Date.now()}`);
      const enterClass = nextDirection === 'forward' ? 'step-enter-from-right' : 'step-enter-from-left';
      setAnimationClass(enterClass);

      window.requestAnimationFrame(() => {
        setAnimationClass('step-enter-active');
        window.setTimeout(() => setIsAnimating(false), 220);
      });
    }, 160);
  };

  const validateDetailsStep = () => {
    const descriptionError = requestState.description.trim().length < 20
      ? 'Please add a bit more detail (at least 20 characters)'
      : '';
    const phoneError = requestState.phoneNumber.trim() === ''
      ? 'Please enter your contact number'
      : '';
    const photoError = requestState.photos.length === 0
      ? 'Please attach at least one photo of the damage'
      : '';

    setDetailsErrors({ description: descriptionError, phoneNumber: phoneError, photos: photoError });
    return descriptionError === '' && phoneError === '' && photoError === '';
  };

  const canContinue = useMemo(() => {
    if (activeStep === 'category') {
      return false;
    }

    if (activeStep === 'brand') {
      return !!requestState.brandId;
    }

    if (activeStep === 'model') {
      return !!requestState.modelId;
    }

    if (activeStep === 'accessoryType') {
      return !!requestState.accessoryTypeId;
    }

    if (activeStep === 'issues') {
      return requestState.issueType.length > 0;
    }

    if (activeStep === 'details') {
      return requestState.description.trim().length >= 20 && requestState.phoneNumber.trim() !== '' && requestState.photos.length > 0;
    }

    return confirmChecked && !createMutation.isPending;
  }, [activeStep, requestState, confirmChecked, createMutation.isPending]);

  const progress = activeStep === 'category' ? 4 : Math.round(((currentStep + 1) / totalSteps) * 100);

  const stepTitle = useMemo(() => {
    if (activeStep === 'category') {
      return 'Choose a category';
    }
    if (activeStep === 'brand') {
      return requestState.category === 'phone' || requestState.category === 'laptop'
        ? `Select your ${requestState.category}`
        : 'Select a brand';
    }
    if (activeStep === 'model') {
      return 'Select the model';
    }
    if (activeStep === 'accessoryType') {
      return 'What type of accessory?';
    }
    if (activeStep === 'issues') {
      return 'What needs fixing?';
    }
    if (activeStep === 'details') {
      return 'Almost done';
    }
    return 'Review your request';
  }, [activeStep, requestState.category]);

  const stepSubtitle = useMemo(() => {
    if (requestState.category) {
      return CATEGORY_LABELS[requestState.category];
    }
    return 'New request';
  }, [requestState.category]);

  const handleContinue = () => {
    if (activeStep === 'details') {
      if (!validateDetailsStep()) {
        return;
      }
    }

    if (activeStep === 'review') {
      handleSubmit();
      return;
    }

    const nextStep = getNextStep(currentStep);
    if (nextStep === currentStep) {
      return;
    }
    animateToStep(nextStep, 'forward');
  };

  const handleBack = () => {
    if (currentStep === 0) {
      navigate(-1);
      return;
    }
    const previousStep = getPreviousStep(currentStep);
    animateToStep(previousStep, 'back');
  };

  const buildIssueValue = () => {
    return resolveIssueLabels(requestState.issueType, requestState.customIssue).join(', ');
  };

  const handleSubmit = () => {
    if (!requestState.category) return;

    setSubmitError(null);
    const issueValues = resolveIssueLabels(requestState.issueType, requestState.customIssue);
    const payload = {
      category: requestState.category,
      brand: requestState.brand,
      model: requestState.model,
      accessoryType: requestState.accessoryType,
      issues: issueValues,
      customIssue: requestState.customIssue,
      description: requestState.description.trim(),
      priority: requestState.priority,
      studentPhone: requestState.phoneNumber.trim(),
      additionalNotes: requestState.additionalNotes.trim(),
      photos: requestState.photos,
    } as any;

    createMutation.mutate(payload, {
      onSuccess: (newRequest) => {
        navigate(`/app/requests/${newRequest.id}`);
      },
      onError: (error: any) => {
        setSubmitError(error?.message || 'Something went wrong. Please try again.');
      },
    });
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const fileArray = Array.from(files);
    if (requestState.photos.length + fileArray.length > 5) {
      setSubmitError('You can attach a maximum of 5 photos.');
      return;
    }

    fileArray.forEach((file) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setSubmitError('Format not supported. Please upload JPEG, PNG, or WEBP only.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setSubmitError('File too large. Max allowed size is 5MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setRequestState((prev) => ({ ...prev, photos: [...prev.photos, reader.result as string] }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setRequestState((prev) => ({ ...prev, photos: prev.photos.filter((_, idx) => idx !== index) }));
  };

  const renderCategoryStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-[#555555]">Choose the request type that best matches your repair.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CATEGORY_OPTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => handleCategorySelect(item.value)}
              className="h-[130px] w-full rounded-xl border border-[#E5E5E3] bg-white p-4 text-left transition hover:border-[#111111] hover:bg-[#F7F7F5] flex flex-col justify-between"
            >
              <div className="w-10 h-10 rounded-2xl bg-[#F1F2E9] flex items-center justify-center text-[#111111]">
                <Icon className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#111111]">{item.label}</p>
                <p className="text-xs text-[#999999] leading-tight">{item.subtitle}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderSelectionFlow = () => {
    if (requestState.category === 'phone') {
      return <PhoneFlow step={currentStep} data={requestState} setData={mergeState} />;
    }
    if (requestState.category === 'laptop') {
      return <LaptopFlow step={currentStep} data={requestState} setData={mergeState} />;
    }
    if (requestState.category === 'accessories') {
      return <AccessoriesFlow step={currentStep} data={requestState} setData={mergeState} />;
    }
    if (requestState.category === 'clothing') {
      return <ClothingFlow data={requestState} setData={mergeState} />;
    }
    if (requestState.category === 'shoe') {
      return <ShoesFlow data={requestState} setData={mergeState} />;
    }
    return null;
  };

  const renderDetailsStep = () => (
    <div className="space-y-6 pb-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#999999]">DESCRIBE THE ISSUE</p>
        <textarea
          ref={detailsTextareaRef}
          value={requestState.description}
          onChange={(event) => setRequestState((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Describe the problem in your own words. The more detail you give, the better we can help."
          className="w-full min-h-[120px] max-h-[240px] resize-none border border-[#E5E5E3] rounded-[8px] px-3 py-3 text-[14px] text-[#111111] placeholder-[#999999] focus:outline-none focus:border-2 focus:border-[#111111]"
        />
        <div className="flex justify-end text-[12px] text-[#999999] mt-2">{requestState.description.length} characters</div>
        {detailsErrors.description ? (
          <p className="text-[12px] text-[#555555] mt-2">{detailsErrors.description}</p>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#999999]">PHOTOS</p>
          <span className="text-[11px] font-semibold text-[#111111]">Required</span>
        </div>
        <p className="text-[12px] text-[#999999] mt-2">Attach at least one photo, up to 5 images. This helps providers evaluate your request faster.</p>
        <div className="relative mt-3 w-full h-[96px] border border-dashed border-[#E5E5E3] rounded-[8px] flex items-center justify-center text-center px-4">
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="space-y-1 text-[#999999]">
            <div className="flex items-center justify-center gap-2 text-[13px]">
              <Camera className="w-5 h-5" />
              <span>Tap to add photos</span>
            </div>
            <p className="text-[11px]">Up to 5 photos · Max 5MB each</p>
          </div>
        </div>
        {requestState.photos.length > 0 && (
          <div className="flex gap-2 flex-wrap mt-3">
            {requestState.photos.map((photo, idx) => (
              <div key={idx} className="relative w-[72px] h-[72px] rounded-[8px] overflow-hidden border border-[#E5E5E3]">
                <img src={photo} alt={`Upload preview ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 flex items-center justify-center text-[#111111] hover:bg-[#F7F7F5] transition"
                  aria-label="Remove photo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        {detailsErrors.photos ? (
          <p className="text-[12px] text-[#E74C3C] mt-2">{detailsErrors.photos}</p>
        ) : null}
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#999999]">PRIORITY</p>
        <div className="mt-3 rounded-[8px] border border-[#E5E5E3] overflow-hidden">
          {PRIORITY_OPTIONS.map((item, idx) => {
            const selected = requestState.priority === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setRequestState((prev) => ({ ...prev, priority: item.value }))}
                className={`w-full h-[52px] px-4 flex items-center justify-between text-[14px] font-medium transition ${
                  selected ? 'bg-[#F7F7F5]' : 'bg-white hover:bg-[#F7F7F5]'
                } ${idx < PRIORITY_OPTIONS.length - 1 ? 'border-b border-[#E5E5E3]' : ''}`}
              >
                <span className="text-[#111111]">{item.label}</span>
                {selected ? (
                  <span className="h-4 w-4 rounded-full bg-[#111111] flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#999999]">ANYTHING ELSE? (OPTIONAL)</p>
        <input
          type="text"
          value={requestState.additionalNotes}
          onChange={(event) => setRequestState((prev) => ({ ...prev, additionalNotes: event.target.value }))}
          placeholder="e.g. I need this back before Friday — I travel on Saturday."
          className="w-full h-[40px] mt-3 px-3 border border-[#E5E5E3] rounded-[6px] text-[13px] text-[#111111] placeholder-[#999999] focus:outline-none focus:border-2 focus:border-[#111111]"
        />
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#999999]">YOUR CONTACT NUMBER</p>
        <p className="text-[12px] text-[#999999] mt-1">Pre-filled from your profile. Edit if different.</p>
        <input
          type="text"
          value={requestState.phoneNumber}
          onChange={(event) => setRequestState((prev) => ({ ...prev, phoneNumber: event.target.value }))}
          className="w-full h-[40px] mt-3 px-3 border border-[#E5E5E3] rounded-[6px] text-[14px] text-[#111111] placeholder-[#999999] focus:outline-none focus:border-2 focus:border-[#111111]"
          placeholder="e.g. +230 5111 2233"
        />
        {detailsErrors.phoneNumber ? (
          <p className="text-[12px] text-[#555555] mt-2">{detailsErrors.phoneNumber}</p>
        ) : null}
      </div>
    </div>
  );

  const renderReviewStep = () => {
    const issueValues = buildIssueValue();
    const rows = [
      { label: 'CATEGORY', value: requestState.category ? CATEGORY_LABELS[requestState.category] : '' },
      { label: 'BRAND', value: requestState.brand || '' },
      { label: 'MODEL', value: requestState.model || '' },
      { label: 'ISSUES', value: issueValues || '' },
      { label: 'PRIORITY', value: requestState.priority },
      { label: 'PHOTOS', value: requestState.photos.length > 0 ? `${requestState.photos.length} photos attached` : 'None' },
    ].filter((row) => row.value);

    return (
      <div className="space-y-6 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#999999]">YOUR SELECTIONS</p>
          <button
            type="button"
            onClick={() => animateToStep(0, 'back')}
            className="text-[13px] font-semibold text-[#555555]"
          >
            Edit
          </button>
        </div>

        <div className="border-t border-b border-[#E5E5E3]">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between h-[48px] px-0 border-b border-[#E5E5E3] last:border-b-0">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#999999]">{row.label}</span>
              <span className="text-[14px] font-semibold text-[#111111] text-right">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="pt-8">
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#999999]">YOUR DESCRIPTION</p>
          <div className="mt-3 text-[14px] leading-6 text-[#555555]">
            {showFullDescription || requestState.description.length <= 240
              ? requestState.description
              : `${requestState.description.slice(0, 240).trim()}...`}
          </div>
          {requestState.description.length > 240 && (
            <button
              type="button"
              onClick={() => setShowFullDescription((prev) => !prev)}
              className="mt-2 text-[13px] font-semibold text-[#555555]"
            >
              {showFullDescription ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setConfirmChecked((prev) => !prev)}
            className={`w-[40px] h-[40px] rounded-[6px] border border-[#E5E5E3] flex items-center justify-center transition ${
              confirmChecked ? 'bg-[#111111]' : 'bg-white'
            }`}
            aria-pressed={confirmChecked}
          >
            {confirmChecked ? <Check className="w-4 h-4 text-white" /> : null}
          </button>
          <div className="text-[13px] text-[#555555] leading-6">
            I confirm these details are correct and I'm ready to submit.
          </div>
        </div>
        {submitError ? (
          <p className="text-[13px] text-[#555555]">{submitError}</p>
        ) : null}
      </div>
    );
  };

  const renderCurrentStep = () => {
    if (activeStep === 'category') {
      return renderCategoryStep();
    }
    if (
      activeStep === 'brand' ||
      activeStep === 'model' ||
      activeStep === 'accessoryType' ||
      activeStep === 'issues'
    ) {
      return renderSelectionFlow();
    }
    if (activeStep === 'details') {
      return renderDetailsStep();
    }
    return renderReviewStep();
  };

  const buttonLabel = activeStep === 'details'
    ? 'Review My Request'
    : activeStep === 'review'
    ? 'Confirm & Submit'
    : 'Continue';

  const isSubmitting = createMutation.isPending;

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#111111] pb-[92px]">
      <div className="sticky top-0 z-50 bg-white">
        <div className="border-b border-[#E5E5E3] bg-white px-4 pt-4 pb-3 sm:px-6">
          <GuidedStepHeader
            title={stepTitle}
            stepLabel={stepSubtitle}
            stepCount={stepCountLabel}
            onBack={handleBack}
          />
          <GuidedProgressBar progress={progress} />
        </div>
      </div>

      <main className="mx-auto mt-6 max-w-4xl px-4 pb-[92px] pt-0 sm:px-6">
        <div key={renderKey} className={`unified-step-wrapper transition-all ${animationClass}`}>
          {renderCurrentStep()}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#E5E5E3] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex justify-end max-w-4xl">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue || isAnimating || isSubmitting}
            className={`h-[52px] min-w-[150px] rounded-full px-6 ${
              canContinue && !isAnimating && !isSubmitting
                ? 'bg-[#111111] text-white'
                : 'bg-[#E5E5E3] text-[#999999]'
            } text-[15px] font-medium transition`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {buttonLabel}
              </span>
            ) : (
              buttonLabel
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
