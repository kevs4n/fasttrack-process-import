const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const logger = require('../utils/logger');

class ExcelProcessor {
  constructor() {
    this.supportedFormats = ['.xlsx', '.xls'];
  }

  /**
   * Process Excel file and extract business process data
   */
  async processFile(filePath, options = {}) {
    try {
      logger.info(`Processing Excel file: ${filePath}`);

      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;

      if (sheetNames.length === 0) {
        throw new Error('No sheets found in Excel file');
      }

      // Process the first sheet (or specified sheet)
      const sheetName = options.sheetName || sheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      if (!worksheet) {
        throw new Error(`Sheet '${sheetName}' not found`);
      }

      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // Use array of arrays format
        defval: '' // Default value for empty cells
      });

      if (jsonData.length === 0) {
        throw new Error('No data found in Excel sheet');
      }

      // Identify header row and data structure
      const processedData = this.parseBusinessProcessData(jsonData);

      logger.info(`Processed ${processedData.data.length} rows from Excel file`);

      return {
        success: true,
        headers: processedData.headers,
        data: processedData.data,
        metadata: {
          fileName: path.basename(filePath),
          sheetName: sheetName,
          totalSheets: sheetNames.length,
          sheetNames: sheetNames,
          rowCount: processedData.data.length,
          columnCount: processedData.headers.length,
          processedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Excel processing error:', error);
      throw error;
    }
  }

  /**
   * Parse business process data from Excel format
   */
  parseBusinessProcessData(jsonData) {
    // Find header row (typically the first non-empty row)
    let headerRowIndex = 0;
    let headers = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row && row.some(cell => cell && cell.toString().trim() !== '')) {
        // Check if this looks like a header row
        const nonEmptyCount = row.filter(cell => cell && cell.toString().trim() !== '').length;
        if (nonEmptyCount >= 3) { // Minimum columns for a valid header
          headers = row.map(cell => cell ? cell.toString().trim() : '');
          headerRowIndex = i;
          break;
        }
      }
    }

    if (headers.length === 0) {
      throw new Error('Could not identify header row in Excel file');
    }

    // Process data rows
    const dataRows = [];
    for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
        continue; // Skip empty rows
      }

      const rowObj = {};
      headers.forEach((header, index) => {
        if (header) {
          rowObj[header] = row[index] ? row[index].toString().trim() : '';
        }
      });

      // Only add rows that have at least some content
      if (Object.values(rowObj).some(value => value !== '')) {
        dataRows.push(rowObj);
      }
    }

    return {
      headers: headers.filter(h => h !== ''),
      data: dataRows
    };
  }

  /**
   * Convert processed data to Azure DevOps CSV format
   */
  async convertToAzureDevOpsFormat(processedData, outputPath, mappingConfig = {}) {
    try {
      logger.info('Converting to Azure DevOps CSV format');

      const azureDevOpsData = this.mapToAzureDevOpsFields(processedData, mappingConfig);

      // Define CSV headers for Azure DevOps import
      const csvHeaders = [
        { id: 'workItemType', title: 'Work Item Type' },
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' },
        { id: 'areaPath', title: 'Area Path' },
        { id: 'iterationPath', title: 'Iteration Path' },
        { id: 'assignedTo', title: 'Assigned To' },
        { id: 'state', title: 'State' },
        { id: 'priority', title: 'Priority' },
        { id: 'processSequenceId', title: 'Process Sequence ID' },
        { id: 'businessValue', title: 'Business Value' },
        { id: 'timeCriticality', title: 'Time Criticality' },
        { id: 'effort', title: 'Effort' },
        { id: 'risk', title: 'Risk' },
        { id: 'businessOwner', title: 'Business Owner' },
        { id: 'businessProcessLead', title: 'Business Process Lead' },
        { id: 'responsibleParty', title: 'Responsible Party' },
        { id: 'tags', title: 'Tags' },
        { id: 'parentId', title: 'Parent ID' }
      ];

      const csvWriter = createCsvWriter({
        path: outputPath,
        header: csvHeaders
      });

      await csvWriter.writeRecords(azureDevOpsData);

      logger.info(`Azure DevOps CSV file created: ${outputPath}`);

      return {
        success: true,
        outputPath,
        recordCount: azureDevOpsData.length
      };

    } catch (error) {
      logger.error('CSV conversion error:', error);
      throw error;
    }
  }

  /**
   * Map business process data to Azure DevOps work item fields
   */
  mapToAzureDevOpsFields(processedData, mappingConfig) {
    const { data } = processedData;
    const azureDevOpsData = [];

    data.forEach((row, index) => {
      // Determine work item type based on level or content
      const workItemType = this.determineWorkItemType(row, mappingConfig);

      const mappedRow = {
        workItemType,
        title: this.extractTitle(row, mappingConfig),
        description: this.extractDescription(row, mappingConfig),
        areaPath: mappingConfig.defaultAreaPath || 'Project',
        iterationPath: mappingConfig.defaultIterationPath || 'Project\\Iteration 1',
        assignedTo: this.extractAssignedTo(row, mappingConfig),
        state: mappingConfig.defaultState || 'New',
        priority: this.extractPriority(row, mappingConfig) || '2',
        processSequenceId: this.extractProcessSequenceId(row, mappingConfig),
        businessValue: this.extractBusinessValue(row, mappingConfig),
        timeCriticality: this.extractTimeCriticality(row, mappingConfig),
        effort: this.extractEffort(row, mappingConfig),
        risk: this.extractRisk(row, mappingConfig),
        businessOwner: this.extractBusinessOwner(row, mappingConfig),
        businessProcessLead: this.extractBusinessProcessLead(row, mappingConfig),
        responsibleParty: this.extractResponsibleParty(row, mappingConfig),
        tags: this.extractTags(row, mappingConfig),
        parentId: this.extractParentId(row, mappingConfig, index)
      };

      azureDevOpsData.push(mappedRow);
    });

    return azureDevOpsData;
  }

  /**
   * Helper methods for field extraction
   */
  determineWorkItemType(row, mappingConfig) {
    // Check common column names that indicate hierarchy level
    const levelColumns = ['Level', 'Hierarchy Level', 'Work Item Type', 'Type'];
    
    for (const col of levelColumns) {
      if (row[col]) {
        const value = row[col].toString().toLowerCase();
        if (value.includes('end-to-end') || value.includes('1')) return 'End-to-end';
        if (value.includes('process area') || value.includes('area') || value.includes('2')) return 'Process area';
        if (value.includes('process') || value.includes('3')) return 'Process';
        if (value.includes('scenario') || value.includes('4')) return 'Scenario';
        if (value.includes('configuration')) return 'Configuration deliverable';
        if (value.includes('document')) return 'Document deliverable';
        if (value.includes('workshop')) return 'Workshop';
      }
    }

    // Default based on title content or mapping config
    return mappingConfig.defaultWorkItemType || 'Process';
  }

  extractTitle(row, mappingConfig) {
    const titleColumns = ['Title', 'Name', 'Process Name', 'Business Process', 'Title 1', 'Title 2', 'Title 3', 'Title 4'];
    
    for (const col of titleColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    // Return first non-empty value as fallback
    const values = Object.values(row).filter(v => v && v.toString().trim());
    return values.length > 0 ? values[0].toString().trim() : 'Untitled';
  }

  extractDescription(row, mappingConfig) {
    const descColumns = ['Description', 'Details', 'Notes', 'Summary'];
    
    for (const col of descColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  extractAssignedTo(row, mappingConfig) {
    const assignedColumns = ['Assigned To', 'Owner', 'Responsible'];
    
    for (const col of assignedColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return mappingConfig.defaultAssignedTo || '';
  }

  extractPriority(row, mappingConfig) {
    const priorityColumns = ['Priority', 'Importance'];
    
    for (const col of priorityColumns) {
      if (row[col] && row[col].toString().trim()) {
        const value = row[col].toString().trim();
        // Convert to numeric priority if needed
        if (['high', 'critical', '1'].includes(value.toLowerCase())) return '1';
        if (['medium', 'normal', '2'].includes(value.toLowerCase())) return '2';
        if (['low', '3'].includes(value.toLowerCase())) return '3';
        return value;
      }
    }

    return mappingConfig.defaultPriority || '2';
  }

  extractProcessSequenceId(row, mappingConfig) {
    const seqColumns = ['Process Sequence ID', 'Sequence ID', 'ID', 'Process ID'];
    
    for (const col of seqColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  extractBusinessValue(row, mappingConfig) {
    const valueColumns = ['Business Value', 'Value', 'Business Impact'];
    
    for (const col of valueColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  extractTimeCriticality(row, mappingConfig) {
    const timeColumns = ['Time Criticality', 'Urgency', 'Timeline'];
    
    for (const col of timeColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  extractEffort(row, mappingConfig) {
    const effortColumns = ['Effort', 'Complexity', 'Estimated Effort'];
    
    for (const col of effortColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  extractRisk(row, mappingConfig) {
    const riskColumns = ['Risk', 'Risk Level', 'Estimated Risk'];
    
    for (const col of riskColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  extractBusinessOwner(row, mappingConfig) {
    const ownerColumns = ['Business Owner', 'Owner', 'Business Lead'];
    
    for (const col of ownerColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  extractBusinessProcessLead(row, mappingConfig) {
    const leadColumns = ['Business Process Lead', 'Process Lead', 'Lead'];
    
    for (const col of leadColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  extractResponsibleParty(row, mappingConfig) {
    const partyColumns = ['Responsible Party', 'Party', 'Responsibility'];
    
    for (const col of partyColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  extractTags(row, mappingConfig) {
    const tagColumns = ['Tags', 'Categories', 'Keywords'];
    
    for (const col of tagColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return mappingConfig.defaultTags || '';
  }

  extractParentId(row, mappingConfig, index) {
    const parentColumns = ['Parent ID', 'Parent', 'Parent Work Item'];
    
    for (const col of parentColumns) {
      if (row[col] && row[col].toString().trim()) {
        return row[col].toString().trim();
      }
    }

    return '';
  }

  /**
   * Validate Excel file structure
   */
  async validateFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;

      if (sheetNames.length === 0) {
        return { valid: false, error: 'No sheets found in Excel file' };
      }

      const worksheet = workbook.Sheets[sheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        return { valid: false, error: 'File must contain at least a header row and one data row' };
      }

      return {
        valid: true,
        sheets: sheetNames,
        estimatedRows: jsonData.length - 1
      };

    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new ExcelProcessor();
