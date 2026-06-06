import { createClient } from '@supabase/supabase-js';

export interface MilestoneDetail {
  title: string;
  description: string;
}

export interface FileDetails {
  name: string;
  size: number;
  type: string;
  encryptedPath: string; // relative path under public/uploads
  key: string;           // hex encoded AES key
  iv: string;            // hex encoded AES iv
  storageType?: string;  // 'local' | 'r2' | 'cloudinary'
  r2Key?: string;        // Cloudflare R2 object key
  cloudinaryUrl?: string; // Cloudinary secure URL for the raw file
}

export interface ProjectMetadata {
  id: number; // project_id from smart contract
  title: string;
  description: string;
  creatorAddress: string;
  targetAmount: number;
  category: string; // project category (e.g. Technology, Art, etc.)
  milestonesCount: number;
  milestoneDetails: MilestoneDetail[];
  fileDetails: FileDetails | null;
  createdAt: string;
  projectType: number; // 0: Instant Buy, 1: Crowdfund, 2: Custom Milestone
  clientAddress?: string; // Client address for Custom Milestone
  milestonePercentages?: number[]; // Percentage split for milestones
  imageUrl?: string; // URL/path for the product cover photo
}

export interface CreatorApplication {
  walletAddress: string;
  realName: string;
  email: string;
  portfolio: string;
  zkProof: string;
  nullifierHash: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  lastNameChangeAt?: string | null;
}

// Supabase client initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getAllProjects(): Promise<ProjectMetadata[]> {
  try {
    const { data: dbProjects, error } = await supabase
      .from('projects')
      .select(`
        *,
        milestones:project_milestones(*),
        files:project_files(*)
      `);

    if (error) {
      console.error('Error fetching projects from Supabase:', error);
      return [];
    }

    return (dbProjects || []).map((p: any) => {
      const milestoneDetails = (p.milestones || [])
        .sort((a: any, b: any) => a.index - b.index)
        .map((m: any) => ({
          title: m.title,
          description: m.description,
        }));

      const rawFile = Array.isArray(p.files) ? p.files[0] : p.files;
      const fileDetails = rawFile ? {
        name: rawFile.name,
        size: Number(rawFile.size),
        type: rawFile.type,
        encryptedPath: rawFile.encrypted_path,
        key: rawFile.encryption_key,
        iv: rawFile.encryption_iv,
        storageType: rawFile.storage_type,
        cloudinaryUrl: rawFile.cloudinary_url || undefined,
        r2Key: rawFile.r2_key || undefined
      } : null;

      return {
        id: Number(p.id),
        title: p.title,
        description: p.description,
        creatorAddress: p.creator_address,
        targetAmount: Number(p.target_amount),
        category: p.category,
        milestonesCount: p.milestones ? p.milestones.length : 0,
        milestoneDetails,
        fileDetails,
        createdAt: p.created_at,
        projectType: Number(p.project_type),
        clientAddress: p.client_address || undefined,
        milestonePercentages: (p.milestones || [])
          .sort((a: any, b: any) => a.index - b.index)
          .map((m: any) => m.percentage),
        imageUrl: p.image_url || undefined
      };
    });
  } catch (error) {
    console.error('Error in getAllProjects:', error);
    return [];
  }
}

export async function getProjectById(id: number): Promise<ProjectMetadata | null> {
  try {
    const { data: dbProject, error } = await supabase
      .from('projects')
      .select(`
        *,
        milestones:project_milestones(*),
        files:project_files(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error || !dbProject) {
      if (error) console.error(`Error fetching project ${id} from Supabase:`, error);
      return null;
    }

    const p = dbProject;
    const milestoneDetails = (p.milestones || [])
      .sort((a: any, b: any) => a.index - b.index)
      .map((m: any) => ({
        title: m.title,
        description: m.description,
      }));

    const rawFile = Array.isArray(p.files) ? p.files[0] : p.files;
    const fileDetails = rawFile ? {
      name: rawFile.name,
      size: Number(rawFile.size),
      type: rawFile.type,
      encryptedPath: rawFile.encrypted_path,
      key: rawFile.encryption_key,
      iv: rawFile.encryption_iv,
      storageType: rawFile.storage_type,
      cloudinaryUrl: rawFile.cloudinary_url || undefined,
      r2Key: rawFile.r2_key || undefined
    } : null;

    return {
      id: Number(p.id),
      title: p.title,
      description: p.description,
      creatorAddress: p.creator_address,
      targetAmount: Number(p.target_amount),
      category: p.category,
      milestonesCount: p.milestones ? p.milestones.length : 0,
      milestoneDetails,
      fileDetails,
      createdAt: p.created_at,
      projectType: Number(p.project_type),
      clientAddress: p.client_address || undefined,
      milestonePercentages: (p.milestones || [])
        .sort((a: any, b: any) => a.index - b.index)
        .map((m: any) => m.percentage),
      imageUrl: p.image_url || undefined
    };
  } catch (error) {
    console.error(`Error in getProjectById for ${id}:`, error);
    return null;
  }
}

export async function saveProject(project: ProjectMetadata): Promise<void> {
  try {
    // 1. Upsert projects table
    const { error: projectError } = await supabase
      .from('projects')
      .upsert({
        id: project.id,
        title: project.title,
        description: project.description,
        creator_address: project.creatorAddress,
        target_amount: project.targetAmount,
        category: project.category,
        project_type: project.projectType,
        client_address: project.clientAddress || null,
        image_url: project.imageUrl || null,
        created_at: project.createdAt
      });

    if (projectError) {
      console.error('Error upserting project in Supabase:', projectError);
      throw projectError;
    }

    // 2. Delete existing milestones and re-insert to keep them ordered and unique
    await supabase
      .from('project_milestones')
      .delete()
      .eq('project_id', project.id);

    if (project.milestoneDetails && project.milestoneDetails.length > 0) {
      const milestoneRows = project.milestoneDetails.map((m, idx) => ({
        project_id: project.id,
        index: idx,
        title: m.title,
        description: m.description,
        percentage: project.milestonePercentages?.[idx] || 0
      }));

      const { error: milestoneError } = await supabase
        .from('project_milestones')
        .insert(milestoneRows);

      if (milestoneError) {
        console.error('Error inserting milestones in Supabase:', milestoneError);
      }
    }

    // 3. Delete existing file details and re-insert if present
    await supabase
      .from('project_files')
      .delete()
      .eq('project_id', project.id);

    if (project.fileDetails) {
      const fd = project.fileDetails;
      const { error: fileError } = await supabase
        .from('project_files')
        .insert({
          project_id: project.id,
          name: fd.name,
          size: fd.size,
          type: fd.type,
          encrypted_path: fd.encryptedPath,
          encryption_key: fd.key,
          encryption_iv: fd.iv,
          storage_type: fd.storageType || 'local',
          cloudinary_url: fd.cloudinaryUrl || null,
          r2_key: fd.r2Key || null
        });

      if (fileError) {
        console.error('Error inserting project file in Supabase:', fileError);
      }
    }
  } catch (error) {
    console.error('Error in saveProject:', error);
    throw error;
  }
}

export async function getAllApplications(): Promise<CreatorApplication[]> {
  try {
    const { data, error } = await supabase
      .from('creator_applications')
      .select('*');

    if (error) {
      console.error('Error fetching applications from Supabase:', error);
      return [];
    }

    return (data || []).map((app: any) => ({
      walletAddress: app.wallet_address,
      realName: app.real_name,
      email: app.email,
      portfolio: app.portfolio,
      zkProof: app.zk_proof,
      nullifierHash: app.nullifier_hash,
      status: app.status as any,
      appliedAt: app.applied_at,
      lastNameChangeAt: app.last_name_change_at
    }));
  } catch (error) {
    console.error('Error in getAllApplications:', error);
    return [];
  }
}

export async function getApplicationByAddress(address: string): Promise<CreatorApplication | null> {
  try {
    const { data, error } = await supabase
      .from('creator_applications')
      .select('*')
      .ilike('wallet_address', address)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error(`Error fetching application for ${address} from Supabase:`, error);
      return null;
    }

    return {
      walletAddress: data.wallet_address,
      realName: data.real_name,
      email: data.email,
      portfolio: data.portfolio,
      zkProof: data.zk_proof,
      nullifierHash: data.nullifier_hash,
      status: data.status as any,
      appliedAt: data.applied_at,
      lastNameChangeAt: data.last_name_change_at
    };
  } catch (error) {
    console.error(`Error in getApplicationByAddress for ${address}:`, error);
    return null;
  }
}

export async function saveApplication(app: CreatorApplication): Promise<void> {
  try {
    const { error } = await supabase
      .from('creator_applications')
      .upsert({
        wallet_address: app.walletAddress,
        real_name: app.realName,
        email: app.email,
        portfolio: app.portfolio,
        zk_proof: app.zkProof,
        nullifier_hash: app.nullifierHash,
        status: app.status,
        applied_at: app.appliedAt,
        last_name_change_at: app.lastNameChangeAt || null
      });

    if (error) {
      console.error('Error saving application to Supabase:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in saveApplication:', error);
    throw error;
  }
}
